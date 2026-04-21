# Cybersecurity Labs

A collection of cybersecurity-focused projects covering network analysis, log monitoring, and subnet tooling.

---

## IP Subnet Calculator

**File:** [`ip_subnet_calculator.py`](./ip_subnet_calculator.py)

A desktop GUI tool for network subnetting calculations. Enter any IP address in CIDR notation to instantly see:

- Subnet mask & wildcard mask
- Network address & broadcast address
- First and last usable hosts
- Number of usable hosts
- Full table of alternate subnet masks for the same IP

**Built with:** Python · tkinter · ipaddress

**Run:**
```bash
python ip_subnet_calculator.py
```

---

## My SIEM — Custom Security Information & Event Management System

**Directory:** [`mysiem/`](./mysiem/)

A lightweight, Python-based SIEM that monitors log files in real time and triggers alerts when suspicious patterns are detected.

### How It Works

1. Watches a directory of `.log` files continuously
2. Applies regex-based detection rules to each new log line
3. Counts occurrences per rule within a configurable timeframe
4. Fires an alert when a threshold is exceeded
5. Logs all alerts to `siem_alerts.log` with severity levels

### Detection Rules (configurable via `rules.json`)

| Rule | Pattern | Threshold | Severity |
|------|---------|-----------|----------|
| SSH Brute Force | Failed password attempts | 5 in 5 min | HIGH |
| Suspicious Commands | wget, curl, nc, netcat, chmod +x | 1 | MEDIUM |
| Root Login Attempt | Failed root login | 3 in 5 min | HIGH |

### Files

| File | Description |
|------|-------------|
| `siem.py` | Core SIEM engine — monitoring loop, rule engine, alert generation |
| `rules.json` | Detection rules in JSON format |
| `test_siem.py` | Test script that generates sample events to trigger rules |
| `logs/` | Sample log files used for testing |
| `siem_alerts.log` | Output alert log |

### Run

```bash
# Start the SIEM monitor
python mysiem/siem.py

# Run the test sequence to trigger alerts
python mysiem/test_siem.py
```

**Built with:** Python · re · logging · json · pathlib
