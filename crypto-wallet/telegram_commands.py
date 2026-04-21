"""
Red Tip Trading Bot — Telegram Command Handler
Polls for slash commands and executes bot actions.
Runs as a separate systemd service.
"""

import json
import os
import subprocess
import time
import requests
from pathlib import Path
from datetime import datetime, timezone

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "bot"))
from config import TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

BOT_TOKEN = TELEGRAM_BOT_TOKEN
CHAT_ID   = TELEGRAM_CHAT_ID
API_URL   = f"https://api.telegram.org/bot{BOT_TOKEN}"
BOT_DIR   = Path.home() / "redtip-bot"
STATE_FILE = BOT_DIR / "state.json"
LOG_FILE   = BOT_DIR / "bot.log"
SERVICE    = "redtip-bot"
POLL_SEC   = 2
OFFSET_FILE = BOT_DIR / ".tg_offset"


def send(text, parse_mode="Markdown"):
    try:
        requests.post(f"{API_URL}/sendMessage", json={
            "chat_id": CHAT_ID, "text": text, "parse_mode": parse_mode,
        }, timeout=10)
    except Exception as e:
        print(f"Send error: {e}")


def load_state():
    try:
        with open(STATE_FILE) as f:
            return json.load(f)
    except Exception:
        return {}


def get_offset():
    try:
        return int(OFFSET_FILE.read_text().strip())
    except Exception:
        return 0


def save_offset(offset):
    OFFSET_FILE.write_text(str(offset))


def run_cmd(cmd):
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=10)
        return r.stdout.strip() or r.stderr.strip()
    except Exception as e:
        return str(e)


# ─── COMMAND HANDLERS ──────────────────────────────────────────────────────────

def cmd_status(args):
    state = load_state()
    cap = state.get("capital_usdc", 0)
    in_pos = state.get("in_position", False)
    pos = state.get("position") or {}
    trades = state.get("trade_log", [])
    kills = state.get("kill_switch_triggered", False)

    wins = sum(1 for t in trades if t.get("pnl_usd", 0) > 0)
    losses = len(trades) - wins
    total_pnl = sum(t.get("pnl_usd", 0) for t in trades)
    wr = wins / len(trades) * 100 if trades else 0

    # Bot service status
    svc = run_cmd(f"systemctl --user is-active {SERVICE}")

    lines = [
        f"*RED TIP BOT STATUS*",
        f"Service: `{svc}`",
        f"Capital: `${cap:.2f}` USDC",
        f"Total P&L: `${total_pnl:+.2f}`",
        f"Trades: `{len(trades)}` ({wins}W / {losses}L)",
        f"Win Rate: `{wr:.1f}%`",
    ]

    if kills:
        lines.append(f"KILL SWITCH: TRIGGERED")

    if in_pos and pos:
        entry = pos.get("entry_price", 0)
        sl = pos.get("stop_loss", entry * 0.97)
        tp = pos.get("take_profit", entry * 1.06)
        lines.append(f"\n*Open Position*")
        lines.append(f"Token: `{pos.get('token_symbol', '?')}`")
        lines.append(f"Entry: `${entry:.6f}`")
        lines.append(f"SL: `${sl:.6f}` | TP: `${tp:.6f}`")
        lines.append(f"Since: `{pos.get('entry_time', '?')}`")
    else:
        lines.append(f"\nNo open position. Scanning...")

    send("\n".join(lines))


def cmd_logs(args):
    n = 15
    if args and args[0].isdigit():
        n = min(int(args[0]), 50)
    try:
        lines = LOG_FILE.read_text().splitlines()[-n:]
        send(f"```\n{chr(10).join(lines)}\n```")
    except Exception as e:
        send(f"Error reading logs: {e}")


def cmd_trades(args):
    state = load_state()
    trades = state.get("trade_log", [])
    if not trades:
        send("No trades recorded yet.")
        return

    recent = trades[-10:]
    lines = ["*LAST 10 TRADES*", ""]
    for t in reversed(recent):
        pnl = t.get("pnl_usd", 0)
        emoji = "+" if pnl and pnl > 0 else "-" if pnl and pnl < 0 else "o"
        sym = t.get("symbol", "?")
        action = t.get("action", "?")
        ts = t.get("timestamp", "?")
        if pnl is not None:
            lines.append(f"[{emoji}] `{sym}` {action} `${pnl:+.2f}` {ts}")
        else:
            lines.append(f"[{emoji}] `{sym}` {action} {ts}")
    send("\n".join(lines))


def cmd_pnl(args):
    state = load_state()
    trades = state.get("trade_log", [])
    cap = state.get("capital_usdc", 0)
    start = state.get("start_capital_usd", 100)

    sells = [t for t in trades if t.get("action", "").startswith("sell")]
    wins = [t for t in sells if t.get("pnl_usd", 0) > 0]
    losses = [t for t in sells if t.get("pnl_usd", 0) <= 0]
    total_pnl = sum(t.get("pnl_usd", 0) for t in sells)
    avg_win = sum(t["pnl_usd"] for t in wins) / len(wins) if wins else 0
    avg_loss = sum(t["pnl_usd"] for t in losses) / len(losses) if losses else 0

    lines = [
        f"*P&L SUMMARY*",
        f"Start: `${start:.2f}`",
        f"Current: `${cap:.2f}`",
        f"Total P&L: `${total_pnl:+.2f}` ({total_pnl/start*100:+.1f}%)",
        f"Closed trades: `{len(sells)}`",
        f"Wins: `{len(wins)}` | Losses: `{len(losses)}`",
        f"Win rate: `{len(wins)/len(sells)*100:.1f}%`" if sells else "No closed trades",
        f"Avg win: `${avg_win:+.2f}` | Avg loss: `${avg_loss:+.2f}`",
    ]
    send("\n".join(lines))


def cmd_exit(args):
    flag = BOT_DIR / "exit_now.flag"
    flag.touch()
    send("Exit flag created. Bot will sell current position on next poll cycle (within 30s).")


def cmd_stop(args):
    run_cmd(f"systemctl --user stop {SERVICE}")
    time.sleep(1)
    status = run_cmd(f"systemctl --user is-active {SERVICE}")
    send(f"Bot stopped. Service status: `{status}`")


def cmd_start(args):
    run_cmd(f"systemctl --user start {SERVICE}")
    time.sleep(2)
    status = run_cmd(f"systemctl --user is-active {SERVICE}")
    send(f"Bot started. Service status: `{status}`")


def cmd_restart(args):
    run_cmd(f"systemctl --user restart {SERVICE}")
    time.sleep(2)
    status = run_cmd(f"systemctl --user is-active {SERVICE}")
    send(f"Bot restarted. Service status: `{status}`")


def cmd_dashboard(args):
    send("Dashboard: `http://YOUR_TAILSCALE_IP:7777`\n(Accessible via Tailscale)")


def cmd_help(args):
    send(
        "*RED TIP BOT COMMANDS*\n\n"
        "/status — Capital, position, win rate\n"
        "/logs — Last 15 log lines (/logs 30 for more)\n"
        "/trades — Last 10 trades\n"
        "/pnl — P&L breakdown\n"
        "/exit — Force sell current position\n"
        "/stop — Stop the bot\n"
        "/start — Start the bot\n"
        "/restart — Restart the bot\n"
        "/dashboard — Dashboard URL\n"
        "/help — This message"
    )


COMMANDS = {
    "/status":    cmd_status,
    "/logs":      cmd_logs,
    "/trades":    cmd_trades,
    "/pnl":       cmd_pnl,
    "/exit":      cmd_exit,
    "/stop":      cmd_stop,
    "/start":     cmd_start,
    "/restart":   cmd_restart,
    "/dashboard": cmd_dashboard,
    "/help":      cmd_help,
}


# ─── MAIN POLL LOOP ───────────────────────────────────────────────────────────

def main():
    print("Red Tip Telegram Command Handler running...")
    send("Telegram command handler connected. Send /help for commands.")

    offset = get_offset()

    while True:
        try:
            resp = requests.get(f"{API_URL}/getUpdates", params={
                "offset": offset, "timeout": 30,
            }, timeout=35)
            data = resp.json()

            for update in data.get("result", []):
                offset = update["update_id"] + 1
                save_offset(offset)

                msg = update.get("message", {})
                chat_id = str(msg.get("chat", {}).get("id", ""))
                text = msg.get("text", "").strip()

                # Only respond to Markus
                if chat_id != CHAT_ID:
                    continue

                if not text.startswith("/"):
                    continue

                parts = text.split()
                cmd = parts[0].lower().split("@")[0]  # strip @botname
                args = parts[1:]

                handler = COMMANDS.get(cmd)
                if handler:
                    print(f"Executing: {cmd} {args}")
                    handler(args)
                else:
                    send(f"Unknown command: `{cmd}`\nSend /help for available commands.")

        except requests.exceptions.Timeout:
            continue
        except Exception as e:
            print(f"Error: {e}")
            time.sleep(5)


if __name__ == "__main__":
    main()
