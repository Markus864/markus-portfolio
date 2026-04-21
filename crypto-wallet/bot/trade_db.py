"""
Red Tip Trading Bot — Durable Trade Logger (SQLite)
Append-only trade log that survives state.json corruption.
Also stores daily snapshots for P&L summaries.
"""

import sqlite3
import os
import time
from datetime import datetime, timezone

BOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BOT_DIR, "trades.db")


def _connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Create tables if they don't exist."""
    conn = _connect()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS trades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            action TEXT NOT NULL,
            symbol TEXT NOT NULL,
            entry_price REAL,
            exit_price REAL,
            pnl_usd REAL,
            pnl_pct REAL,
            capital_after REAL,
            reason TEXT,
            success INTEGER DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS daily_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL UNIQUE,
            capital_usd REAL,
            trades_count INTEGER DEFAULT 0,
            wins INTEGER DEFAULT 0,
            losses INTEGER DEFAULT 0,
            pnl_usd REAL DEFAULT 0
        );
    """)
    conn.close()


def log_trade(action: str, symbol: str, entry_price: float = None,
              exit_price: float = None, pnl_usd: float = None,
              pnl_pct: float = None, capital_after: float = None,
              reason: str = None, success: bool = True):
    """Append a trade record."""
    conn = _connect()
    conn.execute(
        """INSERT INTO trades (timestamp, action, symbol, entry_price, exit_price,
           pnl_usd, pnl_pct, capital_after, reason, success)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            datetime.now(timezone.utc).isoformat(),
            action, symbol, entry_price, exit_price,
            pnl_usd, pnl_pct, capital_after, reason,
            1 if success else 0,
        ),
    )
    conn.commit()
    conn.close()


def update_daily_snapshot(capital_usd: float):
    """Upsert today's snapshot with current capital."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    conn = _connect()

    # Get today's trade stats
    row = conn.execute(
        """SELECT COUNT(*) as cnt,
           SUM(CASE WHEN pnl_usd > 0 THEN 1 ELSE 0 END) as wins,
           SUM(CASE WHEN pnl_usd <= 0 AND action LIKE 'sell%' THEN 1 ELSE 0 END) as losses,
           COALESCE(SUM(CASE WHEN action LIKE 'sell%' THEN pnl_usd ELSE 0 END), 0) as pnl
           FROM trades WHERE date(timestamp) = ?""",
        (today,),
    ).fetchone()

    conn.execute(
        """INSERT INTO daily_snapshots (date, capital_usd, trades_count, wins, losses, pnl_usd)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(date) DO UPDATE SET
           capital_usd=excluded.capital_usd, trades_count=excluded.trades_count,
           wins=excluded.wins, losses=excluded.losses, pnl_usd=excluded.pnl_usd""",
        (today, capital_usd, row["cnt"], row["wins"] or 0, row["losses"] or 0, row["pnl"]),
    )
    conn.commit()
    conn.close()


def get_today_summary() -> dict:
    """Get today's trading summary."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    conn = _connect()
    row = conn.execute(
        "SELECT * FROM daily_snapshots WHERE date = ?", (today,)
    ).fetchone()
    conn.close()
    if row:
        return dict(row)
    return {"date": today, "capital_usd": 0, "trades_count": 0,
            "wins": 0, "losses": 0, "pnl_usd": 0}


def get_all_trades(limit: int = 50) -> list[dict]:
    """Get recent trades."""
    conn = _connect()
    rows = conn.execute(
        "SELECT * FROM trades ORDER BY id DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_daily_history(days: int = 30) -> list[dict]:
    """Get daily snapshots for the last N days."""
    conn = _connect()
    rows = conn.execute(
        "SELECT * FROM daily_snapshots ORDER BY date DESC LIMIT ?", (days,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# Auto-init on import
init_db()
