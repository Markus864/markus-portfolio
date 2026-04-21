"""
test_connection.py — S7-300 PROFINET Connection Validator

Verifies connectivity to every PLC in machines.json before running the
full poller. Reads DB1 byte 0 and prints the raw value so you can confirm
the fault DB is accessible and the bit layout matches fault_db_map.json.

Usage:
    python test_connection.py

Expected output (no active faults):
    [PASS] plc-01 (YOUR_PLC_IP_ADDRESS) — DB1 byte 0 = 0b00000000
"""

import json
import sys
from pathlib import Path

import snap7

BASE_DIR = Path(__file__).parent
MACHINES_FILE = BASE_DIR / "machines.json"
FAULT_MAP_FILE = BASE_DIR / "fault_db_map.json"


def load_config() -> tuple[list[dict], dict]:
    with open(MACHINES_FILE) as f:
        machines = json.load(f)
    with open(FAULT_MAP_FILE) as f:
        fault_map = json.load(f)
    return machines, fault_map


def test_machine(machine: dict, fault_map: dict) -> bool:
    client = snap7.client.Client()
    machine_label = f"{machine['id']} ({machine['ip']})"
    try:
        client.connect(machine["ip"], machine["rack"], machine["slot"])
    except Exception as exc:
        print(f"[FAIL] {machine_label} — connection error: {exc}")
        return False

    try:
        data = client.db_read(machine["fault_db"], 0, 1)
        byte_val = data[0]
        print(f"[PASS] {machine_label} — DB{machine['fault_db']} byte 0 = {byte_val:#010b} ({byte_val})")

        # Decode active faults from the map
        active = []
        for entry in fault_map["bits"]:
            if byte_val & (1 << entry["bit"]):
                active.append(entry["code"])
        if active:
            print(f"       Active faults: {', '.join(active)}")
        else:
            print("       No active faults.")
        return True
    except Exception as exc:
        print(f"[FAIL] {machine_label} — DB read error: {exc}")
        return False
    finally:
        try:
            client.disconnect()
        except Exception:
            pass


def main() -> None:
    machines, fault_map = load_config()
    enabled = [m for m in machines if m.get("enabled", True)]

    print(f"Testing {len(enabled)} PLC(s)...\n")
    results = [test_machine(m, fault_map) for m in enabled]

    passed = sum(results)
    failed = len(results) - passed
    print(f"\n{passed} passed, {failed} failed")
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
