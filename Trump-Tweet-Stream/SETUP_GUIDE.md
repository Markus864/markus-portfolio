# Real-Time Trump Tweet Alerts — Setup Guide

> Get an instant Telegram notification every time @realDonaldTrump posts, with the tweet classified by market relevance (tariffs, markets, crypto, geopolitical, energy). Zero recurring cost unless tweets are actually delivered.

---

## What This Does

- Watches @realDonaldTrump's X account in real time via the X Filtered Stream API
- Classifies each tweet: `TARIFF`, `MARKET`, `CRYPTO`, `GEO`, `ENERGY`, or `OTHER`
- Fires a Telegram message to your phone with the full tweet text and a link within seconds of posting
- Runs 24/7 on any Linux machine (Raspberry Pi, VPS, cloud server, home server)
- Uses only Python standard library — no pip installs required

---

## What You Need

| Requirement | Cost | Notes |
|---|---|---|
| X (Twitter) account | Free | Personal or dedicated account |
| X Developer account + app | Free to create | developer.twitter.com |
| X API credits | ~$5 minimum top-up | Pay-per-use, charged per tweet delivered |
| Telegram account | Free | For receiving alerts |
| A Linux machine | Varies | Any always-on device: VPS, Pi, WSL, cloud |
| Python 3.8+ | Free | Usually pre-installed on Linux |

---

## Step 1 — Create an X Developer Account

1. Go to [developer.twitter.com](https://developer.twitter.com)
2. Sign in with your X account
3. Apply for a developer account (takes 2–5 minutes, usually instant approval)
4. Create a new **Project** and **App** inside the developer portal
5. On the **Keys and Tokens** tab of your app, copy your:
   - `Bearer Token` — this is the only credential you need for reading the stream

> **Plan**: Select **Free** or **Basic** tier when setting up. You'll switch to pay-per-use below.

---

## Step 2 — Add Credits (Pay-Per-Use Plan)

The Filtered Stream endpoint requires the **pay-per-use** plan.

1. In the developer portal, go to your account billing settings
2. Add a payment method and top up credits (minimum ~$5 is plenty — tweets cost fractions of a cent each)
3. Your plan becomes **pay-per-use** automatically once a payment method is on file

> **Cost reality**: Trump posts infrequently. At typical X API pricing, $5 in credits could last months or years depending on tweet volume. You are only charged when a tweet matching your filter is delivered.

**Reference**: See the X API overview at [docs.x.com](https://docs.x.com) — the Filtered Stream endpoint is listed under **Streaming & real-time**.

---

## Step 3 — Find Trump's User ID

Trump's permanent X user ID is: **`25073877`**

This never changes even if his username changes. Your AI tool or the script will use this ID, not the username.

To look up any user's ID:
```bash
curl "https://api.x.com/2/users/by/username/realDonaldTrump" \
  -H "Authorization: Bearer YOUR_BEARER_TOKEN"
```

---

## Step 4 — Create a Telegram Bot

You need a Telegram bot to receive the alerts on your phone.

1. Open Telegram and search for **@BotFather**
2. Send `/newbot` and follow the prompts (give it any name)
3. BotFather gives you a **bot token** — save it
4. Send any message to your new bot to activate the chat
5. Get your **chat ID** by visiting:
   ```
   https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates
   ```
   Look for `"chat": {"id": 123456789}` in the response — that number is your chat ID

---

## Step 5 — Set Up Your Linux Machine

Any always-on Linux machine works:

- **Raspberry Pi** (any model with network access)
- **VPS** (DigitalOcean, Linode, Hetzner — $4–6/mo)
- **Cloud instance** (AWS EC2 free tier, Google Cloud)
- **Home server / NAS**
- **WSL2 on Windows** (works, but restarts on reboot unless configured as a service)

Requirements:
- Python 3.8 or higher (`python3 --version`)
- Outbound internet access on port 443 (HTTPS)
- SSH access to deploy the script

---

## Step 6 — Give Your AI Tool This Prompt

Copy and paste the following prompt to your AI assistant (Claude, ChatGPT, Cursor, etc.) to build the watcher script:

---

### Prompt to give your AI:

```
Build me a Python script called trump_watch.py that:

1. Uses the X (Twitter) v2 Filtered Stream API to watch tweets from user ID 25073877 (@realDonaldTrump) in real time, excluding retweets
2. Manages the stream filter rule automatically (creates it on startup, removes stale duplicates)
3. Classifies each tweet into one of: TARIFF, MARKET, CRYPTO, GEO, ENERGY, or OTHER based on keyword matching
4. Sends a Telegram message for every tweet with: category label, full tweet text, timestamp, and a clickable link to the tweet
5. Handles reconnection automatically with exponential backoff on errors
6. Uses Python standard library only — no pip dependencies (urllib, json, ssl, re, signal)
7. Accepts command-line arguments: "setup" (register rule only), "test" (send test Telegram message), "run" (start stream)
8. Logs all activity to trump_watch.log in the same directory

Credentials needed (I will fill these in):
- BEARER_TOKEN = "your_x_bearer_token"
- TG_TOKEN = "your_telegram_bot_token"
- TG_CHAT_ID = "your_telegram_chat_id"
- TRUMP_USER_ID = "25073877"

Classification keywords:
- TARIFF: tariff, trade war, import, export, customs, duty, china trade
- MARKET: stock, market, nasdaq, s&p, dow jones, fed, rate, inflation, recession, economy, gdp
- CRYPTO: bitcoin, btc, crypto, blockchain, ethereum, solana, defi
- GEO: iran, russia, china, nato, war, nuclear, sanction, israel, ukraine, taiwan
- ENERGY: oil, gas, opec, energy, pipeline, crude
- OTHER: anything that doesn't match the above

Telegram message format:
[emoji] TRUMP [CATEGORY]
[tweet text]
[timestamp UTC]
[link to tweet]

Category emojis: TARIFF=⚠️, MARKET=📊, CRYPTO=₿, GEO=🌍, ENERGY=🛢️, OTHER=📢
```

---

## Step 7 — Deploy and Run

**Upload the script to your server:**
```bash
scp trump_watch.py user@your-server:/home/user/trump-watch/
```

**Test Telegram connectivity:**
```bash
python3 trump_watch.py test
```

**Register the stream filter rule on X:**
```bash
python3 trump_watch.py setup
```

**Start the watcher:**
```bash
# Run in background
nohup python3 trump_watch.py run > trump_watch.log 2>&1 &

# Or as a systemd service (recommended for auto-restart on reboot)
```

---

## Step 8 — Run as a Systemd Service (Recommended)

Create `/etc/systemd/system/trump-watch.service`:

```ini
[Unit]
Description=Trump Tweet Watcher
After=network.target

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/home/YOUR_USERNAME/trump-watch
ExecStart=/usr/bin/python3 /home/YOUR_USERNAME/trump-watch/trump_watch.py run
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable trump-watch
sudo systemctl start trump-watch
sudo systemctl status trump-watch
```

---

## Verifying It Works

After `setup` + `run`, check the log:
```bash
tail -f trump_watch.log
```

You should see:
```
[2026-04-21 14:14:22 UTC] Opening filtered stream...
[2026-04-21 14:14:43 UTC] Stream connected. Waiting for tweets...
```

The stream will sit open silently until Trump posts. When he does, you'll see:
```
[2026-04-21 15:30:01 UTC] TWEET [TARIFF] id=192345...: We are announcing 25% tariffs...
```

And your Telegram gets the alert instantly.

---

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `HTTP 403` | No pay-per-use plan activated | Add payment method in X developer portal |
| `HTTP 401` | Invalid bearer token | Re-copy bearer token from developer portal — no extra spaces |
| `HTTP 429` | Rate limited | Script auto-waits 60s and retries |
| Stream connects but no tweets | Rule not created yet | Run `python3 trump_watch.py setup` first |
| Telegram not receiving | Wrong chat_id | Send a message to your bot, re-check `/getUpdates` |

---

## Cost Reference

From [docs.x.com](https://docs.x.com) — Filtered Stream is available on pay-per-use plans. You are charged per tweet delivered, not per month. A $5 credit with low tweet volume (10–50 tweets/day) will last a very long time.

---


