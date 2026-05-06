#!/usr/bin/env python3
"""Pitwall FastF1 Bridge — Phase 1 (historical data, no auth required)

Runs on localhost:7822. Spawned automatically by the Electron main process.
FastF1 disk cache lives in .cache/ next to this file.
"""

import asyncio
import json
import math
import os
import re
import threading
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from collections import OrderedDict
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Optional

import fastf1
import jwt
import numpy as np
import pandas as pd
import uvicorn
from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastf1.internals.f1auth import AUTH_DATA_FILE, clear_auth_token

PORT = 7822
CACHE_DIR = os.path.join(os.path.dirname(__file__), ".cache")
MAX_CACHED_SESSIONS = 3

os.makedirs(CACHE_DIR, exist_ok=True)
fastf1.Cache.enable_cache(CACHE_DIR)

# In-memory session cache — avoids re-parsing Parquet files between requests
_session_cache: OrderedDict = OrderedDict()
_session_cache_lock = asyncio.Lock()


# ---------------------------------------------------------------------------
# Value conversion: pandas/numpy → JSON-serializable Python
# ---------------------------------------------------------------------------

def _cv(v):
    if v is None:
        return None
    if isinstance(v, float) and math.isnan(v):
        return None
    if isinstance(v, pd.Timedelta):
        return None if pd.isna(v) else round(v.total_seconds(), 6)
    if isinstance(v, pd.Timestamp):
        return None if pd.isna(v) else v.isoformat()
    if isinstance(v, np.integer):
        return int(v)
    if isinstance(v, np.floating):
        f = float(v)
        return None if math.isnan(f) else f
    if isinstance(v, np.bool_):
        return bool(v)
    return v


def _df_to_records(df: pd.DataFrame, columns: Optional[list[str]] = None) -> list[dict]:
    if df is None or len(df) == 0:
        return []
    if columns:
        df = df[[c for c in columns if c in df.columns]]
    return [{k: _cv(v) for k, v in row.items()} for _, row in df.iterrows()]


def _safe_iso(dt) -> Optional[str]:
    if dt is None:
        return None
    if isinstance(dt, str):
        return dt
    if isinstance(dt, pd.Timestamp):
        return None if pd.isna(dt) else dt.isoformat()
    try:
        return str(dt)
    except Exception:
        return None


def _add_minutes(iso_str: Optional[str], minutes: int) -> Optional[str]:
    if not iso_str:
        return None
    try:
        dt = datetime.fromisoformat(iso_str.replace('Z', '+00:00'))
        return (dt + timedelta(minutes=minutes)).isoformat()
    except Exception:
        return iso_str


# ---------------------------------------------------------------------------
# Session loading with in-memory LRU cache
# ---------------------------------------------------------------------------

def _load_session_sync(year: int, round_number: int, session_type: str) -> fastf1.core.Session:
    sess = fastf1.get_session(year, round_number, session_type)
    sess.load(laps=True, telemetry=True, weather=True, messages=True)
    return sess


async def _get_session(year: int, round_number: int, session_type: str) -> fastf1.core.Session:
    key = (year, round_number, session_type.upper())
    async with _session_cache_lock:
        if key in _session_cache:
            _session_cache.move_to_end(key)
            return _session_cache[key]

    # Load outside the lock so other requests aren't blocked for 30s
    sess = await asyncio.to_thread(_load_session_sync, year, round_number, session_type)

    async with _session_cache_lock:
        if key not in _session_cache:
            if len(_session_cache) >= MAX_CACHED_SESSIONS:
                _session_cache.popitem(last=False)
            _session_cache[key] = sess
        return _session_cache[key]


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    _session_cache.clear()


app = FastAPI(title="Pitwall FastF1 Bridge", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok", "fastf1_version": fastf1.__version__}


# Simple in-memory cache so we don't hammer the RSS feed on every render
_headlines_cache: dict = {"items": [], "fetched_at": 0}
_HEADLINES_TTL = 300  # 5 minutes

RSS_FEEDS = [
    "https://www.formula1.com/en/latest/all.xml",
    "https://www.fia.com/rss/news",
    "https://feeds.bbci.co.uk/sport/formula1/rss.xml",
    "https://www.motorsport.com/rss/f1/news/",
    "https://www.espn.com/f1/",
]

_META_OG_IMAGE = re.compile(
    r"<meta[^>]+property=[\"']og:image[\"'][^>]+content=[\"']([^\"']+)[\"']",
    re.IGNORECASE,
)
_META_OG_IMAGE_REV = re.compile(
    r"<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+property=[\"']og:image[\"']",
    re.IGNORECASE,
)
_META_TWITTER_IMAGE = re.compile(
    r"<meta[^>]+name=[\"']twitter:image[\"'][^>]+content=[\"']([^\"']+)[\"']",
    re.IGNORECASE,
)
_META_TWITTER_IMAGE_REV = re.compile(
    r"<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+name=[\"']twitter:image[\"']",
    re.IGNORECASE,
)

def _extract_meta_image(html: str) -> str:
    for pattern in (_META_OG_IMAGE, _META_OG_IMAGE_REV, _META_TWITTER_IMAGE, _META_TWITTER_IMAGE_REV):
        match = pattern.search(html)
        if match:
            return match.group(1).strip()
    return ""

def _fetch_og_image(url: str) -> str:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Pitwall/1.0"})
        with urllib.request.urlopen(req, timeout=6) as resp:
            content_type = resp.headers.get("Content-Type", "")
            if "text/html" not in content_type:
                return ""
            charset = resp.headers.get_content_charset() or "utf-8"
            html_bytes = resp.read(200_000)
        html = html_bytes.decode(charset, errors="ignore")
        image = _extract_meta_image(html)
        if image:
            return urllib.parse.urljoin(url, image)
    except Exception:
        return ""
    return ""

def _fetch_image_bytes(url: str) -> tuple[bytes, str] | None:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Pitwall/1.0"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            content_type = resp.headers.get("Content-Type", "")
            if not content_type.startswith("image/"):
                return None
            data = resp.read(600_000)
        return data, content_type
    except Exception:
        return None

def _fetch_headlines_sync() -> list[dict]:
    now = time.time()
    if now - _headlines_cache["fetched_at"] < _HEADLINES_TTL and _headlines_cache["items"]:
        return _headlines_cache["items"]

    aggregated: list[dict] = []
    seen_keys: set[str] = set()
    for feed_url in RSS_FEEDS:
        try:
            req = urllib.request.Request(feed_url, headers={"User-Agent": "Pitwall/1.0"})
            with urllib.request.urlopen(req, timeout=8) as resp:
                xml_bytes = resp.read()
            root = ET.fromstring(xml_bytes)
            ns = {"atom": "http://www.w3.org/2005/Atom"}
            source = (
                (root.findtext(".//channel/title") or root.findtext(".//atom:title", namespaces=ns) or "")
                .replace("RSS", "")
                .strip()
            )
            if not source:
                source = urllib.parse.urlparse(feed_url).netloc.replace("www.", "")
            items = root.findall(".//item") or root.findall(".//atom:entry", ns)
            results = []
            for item in items[:12]:
                title = (item.findtext("title") or item.findtext("atom:title", namespaces=ns) or "").strip()
                link = (item.findtext("link") or item.findtext("atom:link", namespaces=ns) or "").strip()
                if not link:
                    atom_link = item.find("atom:link", ns)
                    link = (atom_link.get("href", "") if atom_link is not None else "").strip()
                pub = (item.findtext("pubDate") or item.findtext("atom:published", namespaces=ns) or "").strip()
                desc = (item.findtext("description") or item.findtext("atom:summary", namespaces=ns) or "").strip()
                image = ""
                media_thumb = item.find("{http://search.yahoo.com/mrss/}thumbnail")
                if media_thumb is not None and media_thumb.get("url"):
                    image = media_thumb.get("url", "").strip()
                if not image:
                    media_content = item.find("{http://search.yahoo.com/mrss/}content")
                    if media_content is not None and media_content.get("url"):
                        image = media_content.get("url", "").strip()
                if not image:
                    enclosure = item.find("enclosure")
                    if enclosure is not None and enclosure.get("url"):
                        image = enclosure.get("url", "").strip()
                if not image and link:
                    image = _fetch_og_image(link)
                if title:
                    key = f"{title}|{link}"
                    if key in seen_keys:
                        continue
                    seen_keys.add(key)
                    results.append({
                        "title": title,
                        "link": link,
                        "pubDate": pub,
                        "description": desc[:240],
                        "source": source,
                        "image": image,
                    })
            if results:
                aggregated.extend(results)
        except Exception:
            continue

    if aggregated:
        _headlines_cache["items"] = aggregated
        _headlines_cache["fetched_at"] = now
        return aggregated

    return _headlines_cache["items"]  # stale data on failure


@app.get("/headlines")
async def get_headlines():
    items = await asyncio.to_thread(_fetch_headlines_sync)
    return {"items": items}


@app.get("/headlines/image")
async def get_headline_image(url: str = Query(..., min_length=5, max_length=2048)):
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="invalid url")
    result = await asyncio.to_thread(_fetch_image_bytes, url)
    if not result:
        return Response(status_code=404)
    data, content_type = result
    return Response(content=data, media_type=content_type)


@app.get("/events")
async def list_events(year: int = Query(..., ge=2018, le=2030)):
    try:
        schedule = await asyncio.to_thread(lambda: fastf1.get_event_schedule(year, include_testing=False))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    events = []
    for _, row in schedule.iterrows():
        rn = int(row.get("RoundNumber", 0))
        if rn == 0:
            continue

        fmt = str(row.get("EventFormat", "conventional"))
        session_dates: list[tuple[str, Optional[str]]] = []
        for i in range(1, 6):
            label = row.get(f"Session{i}")
            date = _safe_iso(row.get(f"Session{i}Date"))
            if label:
                session_dates.append((str(label), date))

        if fmt in ("sprint_shootout", "sprint_qualifying"):
            sessions = [
                {"type": "FP1", "name": "Practice 1"},
                {"type": "SQ", "name": "Sprint Qualifying"},
                {"type": "S", "name": "Sprint"},
                {"type": "Q", "name": "Qualifying"},
                {"type": "R", "name": "Race"},
            ]
        elif fmt == "sprint":
            sessions = [
                {"type": "FP1", "name": "Practice 1"},
                {"type": "Q", "name": "Qualifying"},
                {"type": "FP2", "name": "Practice 2"},
                {"type": "S", "name": "Sprint"},
                {"type": "R", "name": "Race"},
            ]
        else:
            sessions = [
                {"type": "FP1", "name": "Practice 1"},
                {"type": "FP2", "name": "Practice 2"},
                {"type": "FP3", "name": "Practice 3"},
                {"type": "Q", "name": "Qualifying"},
                {"type": "R", "name": "Race"},
            ]

        duration_min = {
            "FP1": 60,
            "FP2": 60,
            "FP3": 60,
            "Q": 90,
            "R": 120,
            "S": 60,
            "SQ": 60,
        }

        def _resolve_session_date(session_name: str) -> Optional[str]:
            for label, date in session_dates:
                if label.lower() == session_name.lower():
                    return date
            return _safe_iso(row.get("EventDate"))

        for sess in sessions:
            date_start = _resolve_session_date(sess["name"])
            sess["date_start"] = date_start
            sess["date_end"] = _add_minutes(date_start, duration_min.get(sess["type"], 90))

        events.append({
            "round_number": rn,
            "event_name": str(row.get("EventName", "")),
            "official_name": str(row.get("OfficialEventName", row.get("EventName", ""))),
            "circuit_name": str(row.get("Location", "")),
            "country": str(row.get("Country", "")),
            "date": _cv(row.get("EventDate")),
            "event_format": fmt,
            "sessions": sessions,
        })

    return events


_LAP_COLS = [
    "Driver", "DriverNumber", "LapNumber", "LapTime",
    "Sector1Time", "Sector2Time", "Sector3Time",
    "Compound", "TyreLife", "FreshTyre", "Stint",
    "PitInTime", "PitOutTime", "IsPersonalBest",
    "TrackStatus", "IsAccurate",
    "SpeedI1", "SpeedI2", "SpeedFL", "SpeedST", "Time",
]


@app.get("/laps")
async def get_laps(
    year: int = Query(...),
    round: int = Query(...),
    session: str = Query(...),
    driver: Optional[str] = None,
):
    try:
        sess = await _get_session(year, round, session)
        laps = sess.laps
        if driver:
            laps = laps.pick_drivers(driver)
        return _df_to_records(laps, _LAP_COLS)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


_TEL_COLS = ["Time", "Date", "RPM", "Speed", "nGear", "Throttle", "Brake", "DRS", "Distance", "X", "Y", "Z"]


@app.get("/telemetry")
async def get_telemetry(
    year: int = Query(...),
    round: int = Query(...),
    session: str = Query(...),
    driver: str = Query(...),
    lap: Optional[int] = None,
):
    try:
        sess = await _get_session(year, round, session)

        def _extract():
            driver_laps = sess.laps.pick_drivers(driver)
            if lap is not None:
                target = driver_laps[driver_laps["LapNumber"] == lap]
            else:
                fl = driver_laps.pick_fastest()
                target = driver_laps[driver_laps["LapNumber"] == fl["LapNumber"]]
            if len(target) == 0:
                return pd.DataFrame()
            return target.iloc[0].get_telemetry()

        tel = await asyncio.to_thread(_extract)
        return _df_to_records(tel, _TEL_COLS)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/stints")
async def get_stints(
    year: int = Query(...),
    round: int = Query(...),
    session: str = Query(...),
):
    try:
        sess = await _get_session(year, round, session)

        def _extract():
            cols = ["Driver", "DriverNumber", "Stint", "Compound", "TyreLife", "FreshTyre", "LapNumber"]
            laps = sess.laps[[c for c in cols if c in sess.laps.columns]].copy()
            stints = []
            for (drv, compound, stint_num), group in laps.groupby(["Driver", "Compound", "Stint"]):
                stints.append({
                    "driver": str(drv),
                    "driver_number": _cv(group["DriverNumber"].iloc[0]),
                    "stint": _cv(stint_num),
                    "compound": str(compound) if compound and not pd.isna(compound) else None,
                    "fresh_tyre": bool(group["FreshTyre"].iloc[0]) if "FreshTyre" in group else None,
                    "tyre_life_start": _cv(group["TyreLife"].iloc[0]) if "TyreLife" in group else None,
                    "lap_start": int(group["LapNumber"].min()),
                    "lap_end": int(group["LapNumber"].max()),
                    "lap_count": len(group),
                })
            return stints

        return await asyncio.to_thread(_extract)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


_WEATHER_COLS = ["Time", "AirTemp", "TrackTemp", "Humidity", "Pressure", "WindSpeed", "WindDirection", "Rainfall"]


@app.get("/weather")
async def get_weather(
    year: int = Query(...),
    round: int = Query(...),
    session: str = Query(...),
):
    try:
        sess = await _get_session(year, round, session)
        return _df_to_records(sess.weather_data, _WEATHER_COLS)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


_RC_COLS = ["Time", "UTC", "Category", "Message", "Flag", "Scope", "Sector", "RacingNumber", "Lap", "Status", "Domain"]


@app.get("/race_control")
async def get_race_control(
    year: int = Query(...),
    round: int = Query(...),
    session: str = Query(...),
):
    try:
        sess = await _get_session(year, round, session)
        return _df_to_records(sess.race_control_messages, _RC_COLS)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


_RESULT_COLS = [
    "DriverNumber", "BroadcastName", "Abbreviation", "DriverId",
    "TeamName", "TeamColor", "FirstName", "LastName",
    "Position", "ClassifiedPosition", "GridPosition",
    "Q1", "Q2", "Q3", "Time", "Status", "Points",
]


@app.get("/drivers")
async def get_drivers(
    year: int = Query(...),
    round: int = Query(...),
    session: str = Query(...),
):
    try:
        sess = await _get_session(year, round, session)

        def _extract():
            rows = []
            results = sess.results
            if results is not None and len(results) > 0:
                for _, r in results.iterrows():
                    full_name = f"{r.get('FirstName', '')} {r.get('LastName', '')}".strip()
                    rows.append({
                        "driver_number": _cv(r.get("DriverNumber")) or 0,
                        "name_acronym": str(r.get("Abbreviation") or r.get("BroadcastName") or r.get("DriverId") or ""),
                        "full_name": full_name or None,
                        "team_name": str(r.get("TeamName") or "") or None,
                        "team_colour": _cv(r.get("TeamColor")) or None,
                    })
                return rows

            laps = sess.laps
            if laps is None or len(laps) == 0:
                return []

            if "DriverNumber" not in laps.columns:
                return []

            seen = set()
            for _, row in laps.iterrows():
                num = _cv(row.get("DriverNumber"))
                if num in seen or num is None:
                    continue
                seen.add(num)
                rows.append({
                    "driver_number": int(num),
                    "name_acronym": str(row.get("Driver") or ""),
                    "full_name": None,
                    "team_name": None,
                    "team_colour": None,
                })
            return rows

        return await asyncio.to_thread(_extract)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/timing")
async def get_timing(
    year: int = Query(...),
    round: int = Query(...),
    session: str = Query(...),
):
    try:
        sess = await _get_session(year, round, session)

        def _extract():
            laps = sess.laps
            if laps is None or len(laps) == 0:
                return []

            if "DriverNumber" not in laps.columns:
                return []

            latest_rows = []
            for driver_number, group in laps.groupby("DriverNumber"):
                if group is None or len(group) == 0:
                    continue
                group = group.sort_values(["LapNumber", "Time"], na_position="last")
                last = group.iloc[-1]
                lap_number = _cv(last.get("LapNumber")) or 0
                time_value = _cv(last.get("Time"))
                time_order = float(time_value) if time_value is not None else float('inf')
                latest_rows.append({
                    "driver_number": int(_cv(driver_number) or 0),
                    "lap_number": int(lap_number),
                    "lap_time": _cv(last.get("LapTime")) or 0,
                    "sector1_time": _cv(last.get("Sector1Time")) or 0,
                    "sector2_time": _cv(last.get("Sector2Time")) or 0,
                    "sector3_time": _cv(last.get("Sector3Time")) or 0,
                    "time": time_value or 0,
                    "_time_order": time_order,
                })

            ordered = sorted(
                latest_rows,
                key=lambda r: (-r["lap_number"], r["_time_order"]),
            )

            now_iso = datetime.utcnow().isoformat()
            leader_time = ordered[0]["_time_order"] if ordered else 0
            prev_time = leader_time
            output = []
            for idx, row in enumerate(ordered, start=1):
                gap = row["_time_order"] - leader_time if math.isfinite(row["_time_order"]) and math.isfinite(leader_time) else 0
                interval = row["_time_order"] - prev_time if math.isfinite(row["_time_order"]) and math.isfinite(prev_time) else 0
                output.append({
                    "driver_number": row["driver_number"],
                    "position": idx,
                    "gap_to_leader": gap,
                    "interval": 0 if idx == 1 else interval,
                    "lap_number": row["lap_number"],
                    "lap_time": row["lap_time"],
                    "sector1_time": row["sector1_time"],
                    "sector2_time": row["sector2_time"],
                    "sector3_time": row["sector3_time"],
                    "time": row["time"],
                    "date": now_iso,
                })
                prev_time = row["_time_order"]

            return output

        return await asyncio.to_thread(_extract)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/telemetry/latest")
async def get_latest_telemetry(
    year: int = Query(...),
    round: int = Query(...),
    session: str = Query(...),
    driver_number: int = Query(...),
):
    try:
        sess = await _get_session(year, round, session)

        def _extract():
            laps = sess.laps
            if laps is None or len(laps) == 0 or "Driver" not in laps.columns:
                return []

            mapping = {}
            for _, row in laps.iterrows():
                num = _cv(row.get("DriverNumber"))
                abbr = row.get("Driver")
                if num is None or not abbr:
                    continue
                mapping[int(num)] = str(abbr)

            abbr = mapping.get(int(driver_number))
            if not abbr:
                return []

            car_data = sess.car_data
            if car_data is None or abbr not in car_data:
                return []

            df = car_data[abbr]
            if df is None or len(df) == 0:
                return []

            last = df.iloc[-1]
            return [{
                "Time": _cv(last.get("Time")) or 0,
                "Date": _cv(last.get("Date")) or None,
                "RPM": _cv(last.get("RPM")) or 0,
                "Speed": _cv(last.get("Speed")) or 0,
                "nGear": _cv(last.get("nGear")) or 0,
                "Throttle": _cv(last.get("Throttle")) or 0,
                "Brake": _cv(last.get("Brake")) or False,
                "DRS": _cv(last.get("DRS")) or 0,
                "Distance": _cv(last.get("Distance")) or 0,
                "X": _cv(last.get("X")) or 0,
                "Y": _cv(last.get("Y")) or 0,
                "Z": _cv(last.get("Z")) or 0,
            }]

        return await asyncio.to_thread(_extract)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/locations")
async def get_locations(
    year: int = Query(...),
    round: int = Query(...),
    session: str = Query(...),
):
    try:
        sess = await _get_session(year, round, session)

        def _extract():
            laps = sess.laps
            if laps is None or len(laps) == 0:
                return []

            mapping = {}
            for _, row in laps.iterrows():
                num = _cv(row.get("DriverNumber"))
                abbr = row.get("Driver")
                if num is None or not abbr:
                    continue
                mapping[str(abbr)] = int(num)

            pos_data = sess.pos_data
            if pos_data is None:
                return []

            rows = []
            now_iso = datetime.utcnow().isoformat()
            for abbr, df in pos_data.items():
                driver_num = mapping.get(str(abbr))
                if driver_num is None or df is None or len(df) == 0:
                    continue
                last = df.iloc[-1]
                rows.append({
                    "driver_number": driver_num,
                    "x": _cv(last.get("X")) or 0,
                    "y": _cv(last.get("Y")) or 0,
                    "z": _cv(last.get("Z")) or 0,
                    "date": _cv(last.get("Date")) or now_iso,
                })

            return rows

        return await asyncio.to_thread(_extract)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/results")
async def get_results(
    year: int = Query(...),
    round: int = Query(...),
    session: str = Query(...),
):
    try:
        sess = await _get_session(year, round, session)
        return _df_to_records(sess.results, _RESULT_COLS)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# GET /circuit_map?year=&round=&session=
# Returns decimated X/Y coordinates from the fastest lap's telemetry, suitable
# for rendering a circuit outline. Coordinates are circuit-relative metric
# values from car position sensors — NOT geographic lat/lon.
# Response: { x: float[], y: float[], bbox: { minX, maxX, minY, maxY }, count: int }
@app.get("/circuit_map")
async def get_circuit_map(
    year: int = Query(...),
    round: int = Query(...),
    session: str = Query(...),
):
    try:
        sess = await _get_session(year, round, session)

        def _extract():
            # Prefer the single overall fastest lap; fall back to shortest valid lap
            try:
                fastest_lap = sess.laps.pick_fastest()
                tel = fastest_lap.get_telemetry()
            except Exception:
                valid_laps = sess.laps.dropna(subset=["LapTime"]).sort_values("LapTime")
                if len(valid_laps) == 0:
                    return None
                tel = valid_laps.iloc[0].get_telemetry()

            if tel is None or len(tel) == 0:
                return None

            # Decimate to ~400 evenly-spaced points
            step = max(1, len(tel) // 400)
            tel = tel.iloc[::step]

            x_arr = tel["X"].to_numpy()
            y_arr = tel["Y"].to_numpy()

            return {
                "x": [float(v) for v in x_arr],
                "y": [float(v) for v in y_arr],
                "bbox": {
                    "minX": _cv(x_arr.min()),
                    "maxX": _cv(x_arr.max()),
                    "minY": _cv(y_arr.min()),
                    "maxY": _cv(y_arr.max()),
                },
                "count": len(x_arr),
            }

        result = await asyncio.to_thread(_extract)
        if result is None:
            raise HTTPException(status_code=404, detail="no telemetry available")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# F1TV Authentication
# FastF1 3.x uses a local HTTP server on a random port. The browser extension
# at https://f1login.fastf1.dev?port=PORT POSTs the subscription token back
# to that server. FastF1 stores the raw JWT in platformdirs user_data_dir.
# ---------------------------------------------------------------------------

F1TV_LOGIN_BASE = "https://f1login.fastf1.dev"

_auth_event = threading.Event()
_pending_token: str | None = None


class _PitwallAuthHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # suppress access logs

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_POST(self):
        global _pending_token
        if self.path != "/auth":
            self.send_response(404)
            self.end_headers()
            return
        content_length = int(self.headers["Content-Length"])
        post_data = self.rfile.read(content_length)
        data = json.loads(post_data.decode("utf-8"))
        decoded_string = urllib.parse.unquote(data.get("loginSession", ""))
        parsed_data = json.loads(decoded_string)

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self._cors()
        self.end_headers()
        self.wfile.write(json.dumps({"status": "ok"}).encode())

        _pending_token = parsed_data.get("data", {}).get("subscriptionToken")
        _auth_event.set()


def _start_auth_server() -> int:
    global _pending_token
    _pending_token = None
    _auth_event.clear()

    httpd = HTTPServer(("127.0.0.1", 0), _PitwallAuthHandler)
    port = httpd.server_port

    def _serve():
        httpd.serve_forever()

    def _wait_and_save():
        global _pending_token
        _auth_event.wait(timeout=300)
        httpd.shutdown()
        if _pending_token:
            AUTH_DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
            AUTH_DATA_FILE.write_text(_pending_token)
            _pending_token = None

    threading.Thread(target=_serve, daemon=True).start()
    threading.Thread(target=_wait_and_save, daemon=True).start()
    return port


def _read_auth_token() -> str | None:
    try:
        token = AUTH_DATA_FILE.read_text().strip()
        return token if token else None
    except Exception:
        return None


def _token_email(token: str) -> str | None:
    try:
        decoded = jwt.decode(token, options={"verify_signature": False}, algorithms=["RS256"])
        return (decoded.get("email")
                or decoded.get("EmailAddress")
                or decoded.get("email_address")
                or None)
    except Exception:
        return None


def _token_valid(token: str) -> bool:
    try:
        decoded = jwt.decode(token, options={"verify_signature": False}, algorithms=["RS256"])
        exp = decoded.get("exp")
        return not (exp and exp < datetime.now().timestamp())
    except Exception:
        return False


@app.get("/auth/f1tv/status")
async def f1tv_auth_status():
    def _check():
        token = _read_auth_token()
        if not token or not _token_valid(token):
            return {"authenticated": False, "email": None}
        return {"authenticated": True, "email": _token_email(token)}
    return await asyncio.to_thread(_check)


@app.post("/auth/f1tv/start")
async def f1tv_start_auth():
    def _check_existing():
        token = _read_auth_token()
        return token if (token and _token_valid(token)) else None
    existing = await asyncio.to_thread(_check_existing)
    if existing:
        return {"status": "already_authenticated"}
    port = await asyncio.to_thread(_start_auth_server)
    return {
        "status": "pending",
        "login_url": f"{F1TV_LOGIN_BASE}?port={port}",
        "instructions": "Sign in to your F1TV account in the browser — Pitwall will detect your credentials automatically.",
    }


@app.delete("/auth/f1tv")
async def f1tv_sign_out():
    await asyncio.to_thread(clear_auth_token)
    return {"success": True}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="info")
