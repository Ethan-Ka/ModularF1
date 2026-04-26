#!/usr/bin/env python3
"""Pitwall FastF1 Bridge — Phase 1 (historical data, no auth required)

Runs on localhost:7822. Spawned automatically by the Electron main process.
FastF1 disk cache lives in .cache/ next to this file.
"""

import asyncio
import json
import math
import os
import threading
import urllib.parse
from collections import OrderedDict
from contextlib import asynccontextmanager
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Optional

import fastf1
import jwt
import numpy as np
import pandas as pd
import uvicorn
from fastapi import FastAPI, HTTPException, Query
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


@app.get("/events")
async def list_events(year: int = Query(..., ge=2018, le=2030)):
    try:
        schedule = await asyncio.to_thread(fastf1.get_event_schedule, year, False)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    events = []
    for _, row in schedule.iterrows():
        rn = int(row.get("RoundNumber", 0))
        if rn == 0:
            continue

        fmt = str(row.get("EventFormat", "conventional"))
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
