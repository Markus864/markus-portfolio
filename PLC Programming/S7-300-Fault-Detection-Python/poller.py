"""
poller.py — S7-300 Fault Detection Poller

Connects to each PLC defined in machines.json, reads the fault data block
at a configurable interval, and detects rising-edge faults using bit-level
comparison against the previous scan. Detected faults are logged to stdout
and optionally forwarded to a webhook endpoint via HTTP POST.

Hardware tested: Siemens S7-300 CPU 319-3 PN/DP (PROFINET)
Library: python-snap7 2.x (ISO-on-TCP, port 102)
"""

import json
import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx
import snap7
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger(__name__)

BASE_DIR = Path(__file__).parent
MACHINES_FILE = BASE_DIR / "machines.json"
FAULT_MAP_FILE = BASE_DIR / "fault_db_map.json"

WEBHOOK_URL = os.getenv("FAULT_WEBHOOK_URL", "")  # optional — leave blank to disable


def load_config() -> tuple[list[dict], dict]:
    with open(MACHINES_FILE) as f:
        machines = json.load(f)
    with open(FAULT_MAP_FILE) as f:
        fault_map = json.load(f)
    return machines, fault_map


def read_db_byte(client: snap7.client.Client, db_number: int, byte_offset: int) -> int:
    """Read a single byte from a data block."""
    data = client.db_read(db_number, byte_offset, 1)
    return data[0]


def extract_bits(byte_value: int, fault_map: dict) -> dict[str, bool]:
    """Return {fault_code: bool} for every bit defined in fault_map."""
    result = {}
    for entry in fault_map["bits"]:
        mask = 1 << entry["bit"]
        result[entry["code"]] = bool(byte_value & mask)
    return result


def detect_rising_edges(prev: dict[str, bool], curr: dict[str, bool]) -> list[str]:
    """Return fault codes that transitioned False → True since last scan."""
    return [code for code, active in curr.items() if active and not prev.get(code, False)]


def post_fault(machine: dict, fault_code: str, fault_map: dict) -> None:
    """Forward a fault event to the configured webhook (fire-and-forget)."""
    if not WEBHOOK_URL:
        return
    entry = next((e for e in fault_map["bits"] if e["code"] == fault_code), {})
    payload = {
        "machine_id": machine["id"],
        "machine_name": machine["name"],
        "fault_code": fault_code,
        "description": entry.get("description", ""),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    try:
        with httpx.Client(timeout=5) as client:
            resp = client.post(WEBHOOK_URL, json=payload)
            resp.raise_for_status()
    except Exception as exc:
        log.warning("Webhook delivery failed for %s/%s: %s", machine["id"], fault_code, exc)


def poll_machine(machine: dict, fault_map: dict, prev_state: dict[str, bool]) -> dict[str, bool]:
    """Connect, read fault DB, detect edges, return current bit state."""
    client = snap7.client.Client()
    try:
        client.connect(machine["ip"], machine["rack"], machine["slot"])
        byte_val = read_db_byte(client, machine["fault_db"], fault_map["db"] - 1 if fault_map["db"] > 0 else 0)
        # fault_db_map uses DB1 byte 0 — read byte offset 0
        byte_val = read_db_byte(client, machine["fault_db"], 0)
        curr_state = extract_bits(byte_val, fault_map)

        rising = detect_rising_edges(prev_state, curr_state)
        for fault_code in rising:
            log.warning("FAULT DETECTED | machine=%s | code=%s", machine["id"], fault_code)
            post_fault(machine, fault_code, fault_map)

        active = [c for c, v in curr_state.items() if v]
        if active:
            log.info("Active faults on %s: %s", machine["id"], active)
        else:
            log.debug("No active faults on %s", machine["id"])

        return curr_state
    except Exception as exc:
        log.error("Poll error for %s (%s): %s", machine["id"], machine["ip"], exc)
        return prev_state
    finally:
        try:
            client.disconnect()
        except Exception:
            pass


def run() -> None:
    machines, fault_map = load_config()
    enabled = [m for m in machines if m.get("enabled", True)]
    log.info("Starting fault poller — %d machine(s) configured", len(enabled))

    # Track previous bit state per machine to detect rising edges
    states: dict[str, dict[str, bool]] = {m["id"]: {} for m in enabled}

    while True:
        for machine in enabled:
            states[machine["id"]] = poll_machine(machine, fault_map, states[machine["id"]])
        # Use the shortest poll_interval across all machines (or default 5 s)
        interval = min(m.get("poll_interval_sec", 5) for m in enabled)
        time.sleep(interval)


if __name__ == "__main__":
    run()
