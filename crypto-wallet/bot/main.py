"""
Red Tip Trading Bot v2 — RSI Mean Reversion
Strategy: Buy RSI <30 bounce in macro uptrend (EMA50 > EMA200)
Tokens: SOL, JUP, JTO, RAY, BONK
Base currency: USDC | SL 3% / TP 6%
"""

import logging
import sys
import os
import time

sys.path.insert(0, os.path.dirname(__file__))

from scanner import scan
from signals import get_token_price
from trader import buy, sell, get_token_balance_lamports, get_sol_balance_lamports
from risk import (
    load_state, save_state, kill_switch_active,
    position_size_usdc_units, record_trade,
    should_stop_loss, should_take_profit,
)
from wallet import get_wallet_address
from config import (
    SCAN_INTERVAL_SEC, POSITION_POLL_SEC,
    USDC_MINT, SOL_MINT, TOKEN_WHITELIST,
    STOP_LOSS_PCT, TAKE_PROFIT_PCT,
)

try:
    from telegram_notify import (
        notify_entry, notify_exit, notify_scan,
        notify_kill_switch, notify_startup, notify_error,
    )
    TELEGRAM_ENABLED = True
except ImportError:
    TELEGRAM_ENABLED = False

try:
    from edge import full_edge_check, kelly_position_size
    EDGE_ENABLED = True
except ImportError:
    EDGE_ENABLED = False

try:
    from trade_db import log_trade, update_daily_snapshot
    DB_ENABLED = True
except ImportError:
    DB_ENABLED = False

BOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(os.path.join(BOT_DIR, "bot.log"), encoding="utf-8"),
    ],
)
log = logging.getLogger(__name__)

USDC_DECIMALS = 1_000_000  # 6 decimal places


def sync_capital(state: dict) -> float:
    """Update state with current on-chain USDC balance."""
    wallet = get_wallet_address()
    raw = get_token_balance_lamports(wallet, USDC_MINT)
    usdc_balance = raw / USDC_DECIMALS
    state["capital_usdc"] = usdc_balance
    save_state(state)
    log.info(f"Capital synced: ${usdc_balance:.2f} USDC")
    return usdc_balance


def get_position_token_units(mint: str) -> int:
    """Get on-chain token balance. Handles both native SOL and SPL tokens."""
    wallet = get_wallet_address()
    if mint == SOL_MINT:
        lamports = get_sol_balance_lamports(wallet)
        return max(0, lamports - 10_000_000)  # keep 0.01 SOL for fees
    return get_token_balance_lamports(wallet, mint)


def monitor_position(state: dict, entry_price: float, mint: str, symbol: str):
    """Monitor open position. Exit on TP, SL, or manual exit flag."""
    log.info(f"Monitoring {symbol} | entry=${entry_price:.6f}")

    while True:
        # Manual exit flag
        flag_path = os.path.join(BOT_DIR, "exit_now.flag")
        if os.path.exists(flag_path):
            log.warning("Manual exit flag detected — exiting position immediately")
            os.remove(flag_path)
            current_price = get_token_price(mint) or entry_price
            _exit_position(state, mint, entry_price, current_price, symbol, "manual_exit")
            return

        current_price = get_token_price(mint)
        if current_price is None:
            log.warning(f"{symbol}: price unavailable, retrying...")
            time.sleep(POSITION_POLL_SEC)
            continue

        pct = (current_price - entry_price) / entry_price * 100
        log.info(f"{symbol}: current=${current_price:.6f} | {pct:+.2f}%")

        if should_take_profit(entry_price, current_price):
            _exit_position(state, mint, entry_price, current_price, symbol, "take_profit")
            return

        if should_stop_loss(entry_price, current_price):
            _exit_position(state, mint, entry_price, current_price, symbol, "stop_loss")
            return

        time.sleep(POSITION_POLL_SEC)


def _exit_position(state: dict, mint: str, entry_price: float,
                   exit_price: float, symbol: str, reason: str):
    """Sell token back to USDC."""
    token_units = get_position_token_units(mint)
    capital_before = state.get("capital_usdc", 0)

    if token_units > 0:
        success, quote = sell(mint, USDC_MINT, token_units)
    else:
        log.error(f"{symbol}: no token balance found to sell")
        success = False
        quote = None

    pnl_pct = (exit_price - entry_price) / entry_price

    state["in_position"] = False
    state["position"] = None

    if success:
        sync_capital(state)
        pnl_usd = state["capital_usdc"] - capital_before
    else:
        pnl_usd = 0

    record_trade(state, f"sell_{reason}", symbol, entry_price, exit_price, pnl_usd, success)
    if DB_ENABLED:
        log_trade(f"sell_{reason}", symbol, entry_price, exit_price,
                  pnl_usd, pnl_pct * 100, state["capital_usdc"], reason, success)
        update_daily_snapshot(state["capital_usdc"])
    log.info(
        f"Position closed [{reason}]: {symbol} | PnL={pnl_pct:.1%} | "
        f"${pnl_usd:+.2f} | Capital=${state['capital_usdc']:.2f}"
    )

    if TELEGRAM_ENABLED:
        notify_exit(symbol, entry_price, exit_price, pnl_pct * 100,
                    pnl_usd, reason, state["capital_usdc"])


def run():
    log.info("=" * 60)
    log.info("RED TIP TRADING BOT v2 — RSI MEAN REVERSION")
    log.info(f"Tokens: {', '.join(TOKEN_WHITELIST.keys())} | USDC base")
    log.info(f"SL: {STOP_LOSS_PCT:.0%} | TP: {TAKE_PROFIT_PCT:.0%}")
    log.info("=" * 60)

    state = load_state()
    wallet = get_wallet_address()
    log.info(f"Wallet: {wallet}")

    usdc_balance = sync_capital(state)
    log.info(f"Starting capital: ${usdc_balance:.2f} USDC")

    if TELEGRAM_ENABLED:
        notify_startup(usdc_balance, list(TOKEN_WHITELIST.keys()))

    if kill_switch_active(state):
        log.critical("Kill switch active. Bot will not trade. Check state.json.")
        if TELEGRAM_ENABLED:
            notify_kill_switch(usdc_balance)
        return

    while True:
        try:
            if kill_switch_active(state):
                log.critical("Kill switch triggered. Shutting down.")
                if TELEGRAM_ENABLED:
                    notify_kill_switch(state.get("capital_usdc", 0))
                break

            # Resume open position if bot restarted mid-trade
            if state.get("in_position") and state.get("position"):
                pos = state["position"]
                log.info(f"Resuming open position: {pos['token_symbol']}")
                monitor_position(
                    state=state,
                    entry_price=pos["entry_price"],
                    mint=pos["output_mint"],
                    symbol=pos["token_symbol"],
                )
                continue

            # Sync capital and scan
            usdc_balance = sync_capital(state)
            log.info(f"Capital: ${usdc_balance:.2f} USDC | Scanning...")

            result = scan()
            if result is None:
                log.info(f"No setup found. Next scan in {SCAN_INTERVAL_SEC}s")
                time.sleep(SCAN_INTERVAL_SEC)
                continue

            symbol, mint = result

            # Edge check: EV gate + buy pressure + X sentiment
            if EDGE_ENABLED:
                edge = full_edge_check(mint, symbol)
                if not edge["pass"]:
                    log.info(f"Edge check BLOCKED {symbol}. Skipping.")
                    time.sleep(SCAN_INTERVAL_SEC)
                    continue

            # Get entry price
            entry_price = get_token_price(mint)
            if not entry_price:
                log.warning(f"Could not get price for {symbol}. Skipping.")
                time.sleep(SCAN_INTERVAL_SEC)
                continue

            # Size position — Kelly if available, otherwise flat 90%
            if EDGE_ENABLED:
                kelly_usdc = kelly_position_size(usdc_balance)
                usdc_units = int(kelly_usdc * 1_000_000)
                log.info(f"Kelly sizing: ${kelly_usdc:.2f} ({kelly_usdc/usdc_balance*100:.1f}% of capital)")
            else:
                usdc_units = position_size_usdc_units(usdc_balance)
            if usdc_units < 1_000_000:  # Less than $1
                log.warning("Position too small to trade.")
                time.sleep(SCAN_INTERVAL_SEC)
                continue

            if TELEGRAM_ENABLED:
                notify_scan(symbol, 30, 0, 0)

            # Execute buy
            usdc_amount = usdc_units / USDC_DECIMALS
            log.info(f"ENTERING: {symbol} | ${usdc_amount:.2f} USDC | entry=${entry_price:.6f}")
            success, quote = buy(USDC_MINT, mint, usdc_units)

            if not success:
                log.error(f"Buy failed for {symbol}. Skipping.")
                if TELEGRAM_ENABLED:
                    notify_error(f"Buy failed for {symbol}")
                time.sleep(SCAN_INTERVAL_SEC)
                continue

            # Get actual token balance received
            token_units = get_position_token_units(mint)

            state["in_position"] = True
            state["position"] = {
                "output_mint": mint,
                "token_symbol": symbol,
                "entry_price": entry_price,
                "stop_loss": entry_price * (1 - STOP_LOSS_PCT),
                "take_profit": entry_price * (1 + TAKE_PROFIT_PCT),
                "token_amount_units": token_units,
                "entry_time": time.strftime("%Y-%m-%dT%H:%M:%S"),
            }
            record_trade(state, "buy", symbol, entry_price, None, None, True)
            if DB_ENABLED:
                log_trade("buy", symbol, entry_price, capital_after=state.get("capital_usdc"))
                update_daily_snapshot(state.get("capital_usdc", 0))
            log.info(f"Position open: {symbol} | {token_units} units | monitoring...")

            if TELEGRAM_ENABLED:
                notify_entry(symbol, entry_price, usdc_amount, usdc_balance)

            # Immediately start monitoring
            monitor_position(state, entry_price, mint, symbol)

        except KeyboardInterrupt:
            log.info("Shutdown requested by user.")
            break
        except Exception as e:
            log.exception(f"Unexpected error: {e}")
            if TELEGRAM_ENABLED:
                notify_error(str(e))
            time.sleep(SCAN_INTERVAL_SEC)

    log.info("Bot stopped.")


if __name__ == "__main__":
    run()
