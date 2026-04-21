# S7-300 Fault Detection — Python + python-snap7

Real-time fault detection for Siemens S7-300 PLCs over PROFINET using `python-snap7`. Polls a configurable data block for rising-edge fault bits, logs all events, and optionally forwards them to a webhook endpoint.

## Hardware Tested

| Component | Details |
|-----------|---------|
| CPU | Siemens S7-300 CPU 319-3 PN/DP |
| Protocol | PROFINET (ISO-on-TCP, port 102) |
| Data Block | DB1 — 8 BOOL fault flags at byte 0 |
| Validation | All 8 fault scenarios confirmed live on home lab |

## Fault Map (DB1 Byte 0)

| Bit | Fault Code | Description |
|-----|-----------|-------------|
| 0.0 | `E_STOP` | Emergency stop activated |
| 0.1 | `OVER_TEMP` | Motor or drive over-temperature |
| 0.2 | `PRESSURE_FAULT` | Pneumatic pressure out of range |
| 0.3 | `CONVEYOR_JAM` | Conveyor belt jam detected |
| 0.4 | `DRIVE_FAULT` | VFD drive fault |
| 0.5 | `SENSOR_LOSS` | Sensor signal lost or broken wire |
| 0.6 | `COMMS_TIMEOUT` | PROFINET communication timeout |
| 0.7 | `POWER_CYCLE` | Unexpected power cycle detected |

## Project Structure

```
S7-300-Fault-Detection-Python/
├── poller.py           # Main polling loop — connects, reads DB, detects rising edges
├── test_connection.py  # Pre-flight connection validator
├── machines.json       # PLC inventory (IP, rack, slot, poll interval)
├── fault_db_map.json   # Bit-to-fault-code mapping for DB1
├── requirements.txt
└── README.md
```

## Setup

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

> python-snap7 requires the native `snap7` shared library. Install it with:
> ```bash
> # Debian/Ubuntu
> sudo apt-get install libsnap7-1 libsnap7-dev
> # Or download from https://snap7.sourceforge.net
> ```

### 2. Configure PLCs

Edit `machines.json` to match your network:

```json
[
  {
    "id": "plc-01",
    "name": "S7-300 CPU 319-3 PN/DP",
    "ip": "YOUR_PLC_IP_ADDRESS",
    "rack": 0,
    "slot": 2,
    "fault_db": 1,
    "poll_interval_sec": 5,
    "enabled": true
  }
]
```

### 3. Configure TIA Portal — DB1 Structure

In TIA Portal, create DB1 with the following layout:

| Offset | Name | Type | Initial Value |
|--------|------|------|---------------|
| 0.0 | E_STOP | Bool | FALSE |
| 0.1 | OVER_TEMP | Bool | FALSE |
| 0.2 | PRESSURE_FAULT | Bool | FALSE |
| 0.3 | CONVEYOR_JAM | Bool | FALSE |
| 0.4 | DRIVE_FAULT | Bool | FALSE |
| 0.5 | SENSOR_LOSS | Bool | FALSE |
| 0.6 | COMMS_TIMEOUT | Bool | FALSE |
| 0.7 | POWER_CYCLE | Bool | FALSE |

> **Important:** Disable optimized block access on DB1 so python-snap7 can address it by absolute offset.
> Right-click DB1 → Properties → Attributes → uncheck **Optimized block access**.

### 4. (Optional) Webhook forwarding

Set `FAULT_WEBHOOK_URL` in a `.env` file to POST fault events to an external service:

```env
FAULT_WEBHOOK_URL=https://your-api.example.com/faults
```

## Run

### Validate connectivity first

```bash
python test_connection.py
```

Expected output (no active faults):

```
Testing 1 PLC(s)...

[PASS] plc-01 (YOUR_PLC_IP_ADDRESS) — DB1 byte 0 = 0b00000000 (0)
       No active faults.

1 passed, 0 failed
```

### Start the poller

```bash
python poller.py
```

Sample log output when a fault is detected:

```
2025-01-15T08:32:11 [WARNING] FAULT DETECTED | machine=plc-01 | code=E_STOP
2025-01-15T08:32:11 [INFO]    Active faults on plc-01: ['E_STOP']
```

## Rising-Edge Detection

The poller compares each scan against the previous bit state. Only **new** faults (False → True transitions) trigger log warnings and webhook calls — sustained faults are not re-reported on every poll cycle.

## Stack

`python-snap7 2.x` · `httpx` · `python-dotenv` · Siemens TIA Portal · PROFINET
