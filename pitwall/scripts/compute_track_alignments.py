"""
compute_track_alignments.py

Automatically computes `detailRotation` for every track in metadata.json
by aligning the principal axis of the detailed AVIF circuit image against
the principal axis of the FastF1 telemetry polyline projected into SVG space.

Usage (from repo root):
    python pitwall/scripts/compute_track_alignments.py

Dependencies:
    pip install fastf1 numpy pillow pillow-avif-plugin

The script reads FastF1 2024 season data to obtain polyline geometry
(the 2026 circuit layouts are identical for established circuits).
"""

import json
import math
import os
import re
import sys
import unicodedata
import warnings

import numpy as np

try:
    import pillow_avif  # noqa: F401
except ImportError:
    pass  # Pillow 9.1+ includes native AVIF support; plugin is only needed on older builds

from PIL import Image

try:
    import fastf1
except ImportError:
    print("ERROR: fastf1 not installed. Run: pip install fastf1")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Paths — all resolved to absolute so they work regardless of cwd.
# ---------------------------------------------------------------------------
REPO_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..")
)
METADATA_PATH = os.path.join(
    REPO_ROOT,
    "pitwall", "public", "seasons", "2026", "tracks", "metadata.json",
)
DETAILED_DIR = os.path.join(
    REPO_ROOT,
    "pitwall", "public", "seasons", "2026", "tracks", "detailed",
)
CACHE_DIR = os.path.abspath(
    os.path.join(
        REPO_ROOT,
        "pitwall", "bridge", "fastf1_server", ".cache",
    )
)

# FastF1 telemetry year to use for polyline geometry.
TELEMETRY_YEAR = 2024

# Canonical SVG canvas used for the normalizer (must match frontend usage).
SVG_W = 500
SVG_H = 500
SVG_PAD = 20

# Approximate number of polyline points after decimation.
TARGET_POINTS = 400

# ---------------------------------------------------------------------------
# FILE_TO_DETAIL — mirrors useTrackDetailAsset.ts
# key = metadata.json `file` field value
# value = AVIF filename suffix  (2026track{suffix}detailed.avif)
# ---------------------------------------------------------------------------
FILE_TO_DETAIL: dict[str, str] = {
    "melbourne":   "melbourne",
    "shanghai":    "shanghai",
    "suzuka":      "suzuka",
    "montreal":    "montreal",
    "monaco":      "montecarlo",
    "barcelona":   "catalunya",
    "spielberg":   "spielberg",
    "silverstone": "silverstone",
    "spa":         "spafrancorchamps",
    "budapest":    "hungaroring",
    "zandvoort":   "zandvoort",
    "monza":       "monza",
    "baku":        "baku",
    "singapore":   "singapore",
    "austin":      "austin",
    "mexico_city": "mexicocity",
    "sao_paulo":   "interlagos",
    "las_vegas":   "lasvegas",
    "lusail":      "lusail",
    "abu_dhabi":   "yasmarinacircuit",
}


# ---------------------------------------------------------------------------
# Helper: tokenise a string for schedule matching
# ---------------------------------------------------------------------------

def _normalize(s: str) -> str:
    """Strip accents and lowercase for locale-insensitive comparison."""
    return unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower().strip()


def _tokens(s: str) -> set[str]:
    """Lower-case, accent-stripped word tokens, split on whitespace and hyphens."""
    return set(re.split(r"[\s\-]+", _normalize(s))) - {"", "grand", "prix", "gp"}


def _match_round_number(openf1_names: list[str], schedule) -> int | None:
    """
    Map a list of openf1Names to a 2024 round number.

    Strategy (in order, stopping at first hit):
      1. Exact-string match: any openf1 name equals any schedule field value.
      2. Token-set match: all tokens of the openf1 name are present in the
         candidate's tokens (guards against "Spa" matching "Spain" via substring).

    Returns the integer round number, or None if no match found.
    """
    names_norm = [_normalize(n) for n in openf1_names]
    names_tokens = [_tokens(n) for n in openf1_names]

    cols = ("Location", "OfficialEventName", "EventName", "Country")

    # Pass 1 — exact equality (accent-normalised)
    for _, row in schedule.iterrows():
        candidates = {_normalize(str(row.get(c, ""))) for c in cols} - {"", "nan"}
        for name in names_norm:
            if name in candidates:
                return int(row["RoundNumber"])

    # Pass 2 — token superset (all tokens of name present in candidate tokens)
    for _, row in schedule.iterrows():
        candidates_tokens = [
            _tokens(str(row.get(c, "")))
            for c in cols
        ]
        for ntoks in names_tokens:
            if not ntoks:
                continue
            for ctoks in candidates_tokens:
                if ntoks and ntoks.issubset(ctoks):
                    return int(row["RoundNumber"])

    return None


# ---------------------------------------------------------------------------
# Helper: PCA on a set of 2-D points
# ---------------------------------------------------------------------------

def pca_angle(xs: np.ndarray, ys: np.ndarray):
    """
    Returns (angle_deg, cx, cy, ex, ey) where:
      - angle_deg: angle of the principal axis in degrees (atan2(ey, ex))
      - cx, cy   : centroid
      - ex, ey   : unit eigenvector for the largest eigenvalue
    """
    cx = float(np.mean(xs))
    cy = float(np.mean(ys))
    dx = xs - cx
    dy = ys - cy
    cov_xx = float(np.mean(dx * dx))
    cov_xy = float(np.mean(dx * dy))
    cov_yy = float(np.mean(dy * dy))
    cov = np.array([[cov_xx, cov_xy], [cov_xy, cov_yy]])
    eigenvalues, eigenvectors = np.linalg.eigh(cov)
    # eigh returns eigenvalues in ascending order; take the last (largest).
    ev = eigenvectors[:, -1]
    ex, ey = float(ev[0]), float(ev[1])
    angle_deg = math.degrees(math.atan2(ey, ex))
    return angle_deg, cx, cy, ex, ey


# ---------------------------------------------------------------------------
# Helper: normalise delta to [-180, 180]
# ---------------------------------------------------------------------------

def norm180(delta: float) -> float:
    while delta > 180:
        delta -= 360
    while delta <= -180:
        delta += 360
    return delta


# ---------------------------------------------------------------------------
# Step 1 — Image PCA
# Returns PCA results AND the raw pixel coordinate arrays (xs, ys) so the
# caller can reuse them for the skewness tie-break without a second AVIF load.
# ---------------------------------------------------------------------------

def compute_image_pca(avif_path: str):
    """
    Load the AVIF, apply mask (alpha > 50 AND luminance > 20), collect pixel
    coordinates, and return (angle_deg, cx, cy, ex, ey, xs_f, ys_f, img_w, img_h).
    Raises on file-not-found or too-few-pixels.
    """
    img = Image.open(avif_path).convert("RGBA")
    img_w, img_h = img.size
    arr = np.array(img, dtype=np.float32)  # shape (H, W, 4)

    r, g, b, a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]
    luminance = 0.299 * r + 0.587 * g + 0.114 * b
    mask = (a > 50) & (luminance > 20)

    ys_px, xs_px = np.where(mask)
    if len(xs_px) < 10:
        raise ValueError(f"Too few masked pixels in {avif_path}")

    xs_f = xs_px.astype(np.float64)
    ys_f = ys_px.astype(np.float64)

    angle_deg, cx, cy, ex, ey = pca_angle(xs_f, ys_f)
    return angle_deg, cx, cy, ex, ey, xs_f, ys_f, img_w, img_h


# ---------------------------------------------------------------------------
# Step 2 — Polyline PCA in SVG space
# Returns PCA results AND the projected (svg_x, svg_y) arrays for the
# skewness tie-break.
# ---------------------------------------------------------------------------

def compute_polyline_pca(entry: dict, schedule_2024):
    """
    Load the fastest-lap telemetry for the matching 2024 round, project into
    SVG space via makeNormalizer logic, and return
    (angle_deg, cx, cy, ex, ey, svg_x, svg_y).

    entry        : one element from metadata.json["rounds"]
    schedule_2024: fastf1.get_event_schedule(2024) DataFrame
    """
    openf1_names = entry.get("openf1Names", [])

    round_2024 = _match_round_number(openf1_names, schedule_2024)
    if round_2024 is None:
        raise LookupError(
            f"Could not match {entry['name']!r} openf1Names={openf1_names!r} "
            f"to any 2024 round"
        )

    # Load the race session (suppress verbose FastF1 logging).
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        session = fastf1.get_session(TELEMETRY_YEAR, round_2024, "R")
        session.load(telemetry=True, laps=True, weather=False, messages=False)

    fastest = session.laps.pick_fastest()
    if fastest is None or fastest.empty:
        raise ValueError(
            f"No fastest lap found for {entry['name']!r} (2024 round {round_2024})"
        )

    tel = fastest.get_telemetry()
    if tel is None or len(tel) < 10:
        raise ValueError(
            f"Insufficient telemetry for {entry['name']!r} (2024 round {round_2024})"
        )

    x_raw = tel["X"].to_numpy(dtype=np.float64)
    y_raw = tel["Y"].to_numpy(dtype=np.float64)

    # Remove NaN rows.
    valid = ~(np.isnan(x_raw) | np.isnan(y_raw))
    x_raw, y_raw = x_raw[valid], y_raw[valid]
    if len(x_raw) < 10:
        raise ValueError(f"Too few valid telemetry points for {entry['name']!r}")

    # Decimate to ~TARGET_POINTS using linspace-based index sampling
    # (avoids stride artefacts from variable telemetry density).
    n = len(x_raw)
    if n > TARGET_POINTS:
        indices = np.round(np.linspace(0, n - 1, TARGET_POINTS)).astype(int)
        x_arr = x_raw[indices]
        y_arr = y_raw[indices]
    else:
        x_arr, y_arr = x_raw, y_raw

    # makeNormalizer logic (mirrors trackNormalizer.ts).
    min_x, max_x = x_arr.min(), x_arr.max()
    min_y, max_y = y_arr.min(), y_arr.max()
    range_x = max_x - min_x or 1.0
    range_y = max_y - min_y or 1.0
    scale = min(
        (SVG_W - SVG_PAD * 2) / range_x,
        (SVG_H - SVG_PAD * 2) / range_y,
    )
    off_x = SVG_PAD + ((SVG_W - SVG_PAD * 2) - range_x * scale) / 2
    off_y = SVG_PAD + ((SVG_H - SVG_PAD * 2) - range_y * scale) / 2

    svg_x = off_x + (x_arr - min_x) * scale
    # Y-flip: FastF1 Y increases upward; SVG Y increases downward.
    svg_y = SVG_W - (off_y + (y_arr - min_y) * scale)

    angle_deg, cx, cy, ex, ey = pca_angle(svg_x, svg_y)
    return angle_deg, cx, cy, ex, ey, svg_x, svg_y


# ---------------------------------------------------------------------------
# Step 3 — Compute rotation with 180° ambiguity tie-break via nearest-neighbour
# ---------------------------------------------------------------------------

def _rotate_points(xs: np.ndarray, ys: np.ndarray, angle_deg: float,
                   cx: float, cy: float) -> tuple[np.ndarray, np.ndarray]:
    """Rotate (xs, ys) around (cx, cy) by angle_deg degrees clockwise (SVG convention)."""
    rad = math.radians(angle_deg)
    cos_a, sin_a = math.cos(-rad), math.sin(-rad)  # negate for clockwise
    dx, dy = xs - cx, ys - cy
    return cx + dx * cos_a - dy * sin_a, cy + dx * sin_a + dy * cos_a


def _mean_nn_distance(poly_x: np.ndarray, poly_y: np.ndarray,
                      img_xs: np.ndarray, img_ys: np.ndarray) -> float:
    """
    Average distance from each polyline point to its nearest image-track pixel.
    Uses a coarse grid approximation for speed (img pixels downsampled to ~4000 pts).
    """
    # Downsample image pixels to keep computation fast
    step = max(1, len(img_xs) // 4000)
    ref_x = img_xs[::step].astype(np.float32)
    ref_y = img_ys[::step].astype(np.float32)

    total = 0.0
    for px, py in zip(poly_x.astype(np.float32), poly_y.astype(np.float32)):
        dists = (ref_x - px) ** 2 + (ref_y - py) ** 2
        total += float(np.sqrt(dists.min()))
    return total / len(poly_x)


def compute_delta(
    angle_img, cx_img, cy_img, ex_img, ey_img, xs, ys,
    angle_poly, cx_poly, cy_poly, ex_poly, ey_poly, svg_x, svg_y,
    img_w: int, img_h: int,
) -> float:
    delta = norm180(angle_poly - angle_img)

    # The image pixels are in image space (0..img_w, 0..img_h).
    # The polyline is in 500x500 SVG space.
    # To compare apples-to-apples, scale image pixel coords to 500x500.
    scale_x = SVG_W / img_w
    scale_y = SVG_H / img_h
    img_xs_scaled = xs * scale_x
    img_ys_scaled = ys * scale_y
    img_cx_scaled = cx_img * scale_x
    img_cy_scaled = cy_img * scale_y

    # Candidate A: rotate polyline by delta, translate centroid to image centroid.
    def _score(d: float) -> float:
        rx, ry = _rotate_points(svg_x, svg_y, d, cx_poly, cy_poly)
        # Translate polyline centroid to image centroid
        tx = img_cx_scaled - rx.mean()
        ty = img_cy_scaled - ry.mean()
        return _mean_nn_distance(rx + tx, ry + ty, img_xs_scaled, img_ys_scaled)

    delta_alt = norm180(delta + 180 if delta <= 0 else delta - 180)
    score_a = _score(delta)
    score_b = _score(delta_alt)

    chosen = delta if score_a <= score_b else delta_alt
    return round(chosen, 1)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    # Enable FastF1 cache (path must exist).
    os.makedirs(CACHE_DIR, exist_ok=True)
    fastf1.Cache.enable_cache(CACHE_DIR)

    # Read metadata.
    with open(METADATA_PATH, "r", encoding="utf-8") as f:
        metadata = json.load(f)

    # Load 2024 event schedule once (used to map openf1Names → round numbers).
    print("Loading 2024 F1 event schedule...")
    try:
        schedule_2024 = fastf1.get_event_schedule(TELEMETRY_YEAR, include_testing=False)
    except Exception as exc:
        print(f"ERROR: Could not load 2024 event schedule: {exc}")
        sys.exit(1)

    summary: list[tuple[str, float | None, str]] = []

    for entry in metadata["rounds"]:
        name = entry["name"]
        file_key = entry.get("file")

        # Skip rounds with no file mapping (e.g. Madrid 2026 new circuit).
        if not file_key:
            print(f"Skipping {name!r}: no file mapping")
            summary.append((name, None, "skipped — no file mapping"))
            continue

        suffix = FILE_TO_DETAIL.get(file_key)
        if suffix is None:
            print(f"Skipping {name!r}: '{file_key}' not in FILE_TO_DETAIL")
            summary.append((name, None, f"skipped — '{file_key}' not in FILE_TO_DETAIL"))
            continue

        avif_path = os.path.join(DETAILED_DIR, f"2026track{suffix}detailed.avif")
        if not os.path.isfile(avif_path):
            print(f"Skipping {name!r}: AVIF not found at {avif_path}")
            summary.append((name, None, "skipped — AVIF not found"))
            continue

        # --- Step 1: Image PCA (single AVIF load; returns coords for step 3) ---
        try:
            angle_img, cx_img, cy_img, ex_img, ey_img, xs_f, ys_f, img_w, img_h = (
                compute_image_pca(avif_path)
            )
        except Exception as exc:
            print(f"WARNING: {name!r} image PCA failed: {exc}")
            summary.append((name, None, f"failed — image PCA: {exc}"))
            continue

        # --- Step 2: Polyline PCA (returns coords for step 3) ---
        try:
            angle_poly, cx_poly, cy_poly, ex_poly, ey_poly, svg_x, svg_y = (
                compute_polyline_pca(entry, schedule_2024)
            )
        except Exception as exc:
            print(f"WARNING: {name!r} polyline PCA failed: {exc}")
            summary.append((name, None, f"failed — polyline PCA: {exc}"))
            continue

        # --- Step 3: Compute rotation with nearest-neighbour tie-break ---
        delta = compute_delta(
            angle_img, cx_img, cy_img, ex_img, ey_img, xs_f, ys_f,
            angle_poly, cx_poly, cy_poly, ex_poly, ey_poly, svg_x, svg_y,
            img_w, img_h,
        )

        print(
            f"Processing {name!r}: "
            f"img_angle={angle_img:.2f}, poly_angle={angle_poly:.2f}, "
            f"detailRotation={delta}"
        )
        summary.append((name, delta, "ok"))

        # --- Step 4: Update the entry in the in-memory dict ---
        entry["detailRotation"] = delta

    # Write updated metadata.json (indent=2 per spec; adds trailing newline).
    with open(METADATA_PATH, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print("\n--- Summary ---")
    for track_name, rotation, status in summary:
        if rotation is not None:
            print(f"  {track_name}: detailRotation={rotation}  [{status}]")
        else:
            print(f"  {track_name}: {status}")

    print(f"\nmetadata.json updated at: {METADATA_PATH}")


if __name__ == "__main__":
    main()
