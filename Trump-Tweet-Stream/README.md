# skill: trump-tweet-stream

> Real-time X (Twitter) filtered stream pipeline. Watches a target account (default: @realDonaldTrump), classifies tweets by market relevance, and fires Telegram alerts. Runs on any Linux machine. No pip dependencies.

---

## What This Skill Does

- Registers and manages an X v2 Filtered Stream rule targeting a specific user
- Streams tweets in real time (seconds latency from post to alert)
- Classifies tweet text into market-relevant categories
- Sends formatted Telegram alerts with category, text, timestamp, and tweet link
- Handles reconnection, backoff, and rule deduplication automatically

---

## Required Credentials

| Variable | Description | Where to get it |
|---|---|---|
| `BEARER_TOKEN` | X API Bearer Token | X Developer Portal → Your App → Keys and Tokens |
| `TG_TOKEN` | Telegram Bot Token | @BotFather on Telegram → `/newbot` |
| `TG_CHAT_ID` | Telegram chat ID (numeric) | `api.telegram.org/botTOKEN/getUpdates` after messaging the bot |
| `TRUMP_USER_ID` | Target X user's numeric ID | `api.x.com/2/users/by/username/USERNAME` with bearer token |

**X account requirements**: Developer account at developer.twitter.com + pay-per-use plan (add payment method, ~$5 minimum). Filtered Stream endpoint requires pay-per-use tier.

---

## Actions

### 1. Setup — Register stream rule
```
python3 trump_watch.py setup
```
- Fetches existing rules tagged `trump_redtip`
- Deletes stale duplicates
- Creates rule: `from:USER_ID -is:retweet`
- Logs rule ID confirmation

### 2. Test — Verify Telegram
```
python3 trump_watch.py test
```
- Sends one test message to Telegram
- Does not open the stream
- Use to confirm credentials before going live

### 3. Run — Start live stream
```
python3 trump_watch.py run
```
- Calls `setup` automatically
- Opens `GET https://api.twitter.com/2/tweets/search/stream`
- Reads newline-delimited JSON forever
- On each tweet: classifies → sends Telegram alert
- Reconnects with exponential backoff on any error

---

## Classification Logic

Keyword matching against lowercased tweet text. First match wins.

| Category | Keywords | Emoji |
|---|---|---|
| `TARIFF` | tariff, trade war, import, export, customs, duty, china trade | ⚠️ |
| `MARKET` | stock, market, nasdaq, s&p, dow jones, fed, rate, inflation, recession, economy, gdp | 📊 |
| `CRYPTO` | bitcoin, btc, crypto, blockchain, ethereum, solana, defi | ₿ |
| `GEO` | iran, russia, china, nato, war, nuclear, sanction, israel, ukraine, taiwan | 🌍 |
| `ENERGY` | oil, gas, opec, energy, pipeline, crude | 🛢️ |
| `OTHER` | no match | 📢 |

---

## Telegram Alert Format

```
⚠️ TRUMP [TARIFF]
We are announcing 25% tariffs on ALL imports from China effective immediately. America First!

2026-04-21 14:15 UTC
View tweet → https://x.com/realDonaldTrump/status/TWEET_ID
```

HTML parse mode. Bold category header. Italic timestamp. Clickable link.

---

## X API Endpoints Used

| Endpoint | Method | Purpose |
|---|---|---|
| `GET /2/tweets/search/stream` | Stream | Receive matching tweets in real time |
| `GET /2/tweets/search/stream/rules` | GET | List active filter rules |
| `POST /2/tweets/search/stream/rules` | POST | Add or delete filter rules |
| `GET /2/users/by/username/:username` | GET | Look up user ID by username |

Full reference: https://docs.x.com/x-api/posts/filtered-stream/introduction

---

## Deployment

**Minimum system requirements:**
- Python 3.8+
- Outbound HTTPS (port 443)
- Always-on (systemd service recommended)

**Works on:**
- Raspberry Pi (any model)
- Any VPS (DigitalOcean, Hetzner, Linode, AWS EC2, etc.)
- Home Linux server
- Any cloud instance

**Run as systemd service** (auto-restarts on crash or reboot):
```ini
[Unit]
Description=Trump Tweet Watcher
After=network.target

[Service]
Type=simple
User=YOUR_USER
WorkingDirectory=/path/to/trump-watch
ExecStart=/usr/bin/python3 trump_watch.py run
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

---

## Constraints

- Only fires for NEW tweets while the stream is open (no historical tweets)
- Retweets excluded by rule (`-is:retweet`)
- Replies from Trump ARE included (can add `-is:reply` to rule if desired)
- One filter rule is enough — X charges per tweet delivered, not per rule
- `AUTO_TRADE` flag in script defaults to `False` — trade execution is a separate step requiring explicit activation

---

## Prompts to Give Your AI

### Initial build:
```
Build trump_watch.py: Python 3 stdlib-only script that opens the X v2 Filtered Stream
for user ID [TRUMP_USER_ID], classifies tweets by keyword into TARIFF/MARKET/CRYPTO/GEO/ENERGY/OTHER,
sends a Telegram HTML message per tweet, handles reconnection with backoff.
CLI modes: setup (register rule), test (send test TG message), run (open stream).
Credentials: BEARER_TOKEN, TG_TOKEN, TG_CHAT_ID as constants at top of file.
```

### Deploy to server:
```
Upload trump_watch.py to [user@host]:/home/[user]/trump-watch/ via SCP.
Run python3 trump_watch.py test to verify Telegram.
Run python3 trump_watch.py setup to register the X filter rule.
Create a systemd service that runs trump_watch.py run and auto-restarts.
Enable and start the service. Show me the last 5 lines of the log.
```

### Add trade signal on category:
```
In trump_watch.py, when category == "TARIFF", write manual_order.json to
[REMOTE_HOST]:[ORDER_FILE_PATH] via SSH. The order should be:
{"pair": "EUR_USD", "direction": "short", "capital_pct": 0.20, "sl_pips": 8.0, "tp_pips": 16.0}.
Add a flag AUTO_TRADE=True/False to enable/disable this.
```

---

## Files

| File | Purpose |
|---|---|
| `trump_watch.py` | Main script — stream, classify, alert |
| `trump_watch.log` | Rolling log of all events |

---

*Skill version: 1.0 — Markus864, 2026-04-21*
