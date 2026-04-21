"""
Red Tip Trading Bot — Daily P&L Summary
Sends a Telegram message with today's trading results.
Run via cron at midnight UTC.
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "bot"))

from config import TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
from trade_db import get_today_summary, get_daily_history
import requests

API_URL = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}"


def send(text):
    requests.post(f"{API_URL}/sendMessage", json={
        "chat_id": TELEGRAM_CHAT_ID, "text": text, "parse_mode": "Markdown",
    }, timeout=10)


def main():
    today = get_today_summary()
    history = get_daily_history(7)

    # Weekly totals
    week_pnl = sum(d.get("pnl_usd", 0) for d in history)
    week_trades = sum(d.get("trades_count", 0) for d in history)
    week_wins = sum(d.get("wins", 0) for d in history)

    cap = today.get("capital_usd", 0)
    pnl = today.get("pnl_usd", 0)
    trades = today.get("trades_count", 0)
    wins = today.get("wins", 0)
    losses = today.get("losses", 0)
    wr = wins / (wins + losses) * 100 if (wins + losses) > 0 else 0

    icon = "+" if pnl >= 0 else ""

    lines = [
        "*RED TIP DAILY REPORT*",
        f"Date: `{today.get('date', 'N/A')}`",
        "",
        f"Capital: `${cap:.2f}` USDC",
        f"Day P&L: `{icon}${pnl:.2f}`",
        f"Trades: `{trades}` ({wins}W / {losses}L)",
        f"Win Rate: `{wr:.0f}%`" if trades > 0 else "No trades today",
        "",
        f"*7-Day Rolling*",
        f"P&L: `{'+' if week_pnl >= 0 else ''}${week_pnl:.2f}`",
        f"Trades: `{week_trades}` | Wins: `{week_wins}`",
    ]

    if not trades:
        lines.insert(4, "_No trades executed today._")

    send("\n".join(lines))
    print(f"Daily summary sent: ${pnl:+.2f} | {trades} trades")


if __name__ == "__main__":
    main()
