import json
import logging
import time
from pathlib import Path
from config import (
    POSITION_SIZE_PCT, STOP_LOSS_PCT, TAKE_PROFIT_PCT,
    KILL_SWITCH_FLOOR_USD,
)

log = logging.getLogger(__name__)

STATE_FILE = Path(__file__).parent.parent / "state.json"

DEFAULT_STATE = {
    "capital_usdc": 0.0,
    "in_position": False,
    "position": None,
    "trade_log": [],
    "start_capital_usd": 100.0,
    "peak_capital_usd": 100.0,
    "kill_switch_triggered": False,
}


def load_state() -> dict:
    if STATE_FILE.exists():
        with open(STATE_FILE) as f:
            return json.load(f)
    return DEFAULT_STATE.copy()


def save_state(state: dict):
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)


def kill_switch_active(state: dict) -> bool:
    capital = state.get("capital_usdc", 0)

    if state.get("kill_switch_triggered") and capital >= KILL_SWITCH_FLOOR_USD:
        log.info(f"Kill switch reset — capital recovered to ${capital:.2f}")
        state["kill_switch_triggered"] = False
        save_state(state)
        return False

    if state.get("kill_switch_triggered"):
        return True

    if state.get("in_position"):
        return False

    if 0 < capital < KILL_SWITCH_FLOOR_USD:
        log.critical(f"KILL SWITCH: capital ${capital:.2f} below floor ${KILL_SWITCH_FLOOR_USD}")
        state["kill_switch_triggered"] = True
        save_state(state)
        return True

    return False


def position_size_usdc_units(usdc_balance: float) -> int:
    """Returns USDC amount in raw units (6 decimals) to trade."""
    trade_usdc = usdc_balance * POSITION_SIZE_PCT
    units = int(trade_usdc * 1_000_000)
    log.info(f"Position size: ${trade_usdc:.2f} USDC ({units} raw units)")
    return units


def record_trade(state: dict, action: str, token: str, entry_price: float,
                 exit_price: float | None, pnl_usd: float | None, success: bool):
    entry = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "action": action,
        "token": token,
        "entry_price": entry_price,
        "exit_price": exit_price,
        "pnl_usd": pnl_usd,
        "success": success,
        "capital_after_usd": state.get("capital_usdc", 0),
    }
    state.setdefault("trade_log", []).append(entry)

    if state.get("capital_usdc", 0) > state.get("peak_capital_usd", 0):
        state["peak_capital_usd"] = state["capital_usdc"]

    save_state(state)
    log.info(
        f"Trade recorded: {action} {token} | PnL: ${(pnl_usd or 0):.2f} | "
        f"Capital: ${state.get('capital_usdc', 0):.2f}"
    )


def should_stop_loss(entry_price: float, current_price: float) -> bool:
    drop = (entry_price - current_price) / entry_price
    if drop >= STOP_LOSS_PCT:
        log.warning(
            f"STOP LOSS: entry={entry_price:.6f} current={current_price:.6f} drop={drop:.1%}"
        )
        return True
    return False


def should_take_profit(entry_price: float, current_price: float) -> bool:
    gain = (current_price - entry_price) / entry_price
    if gain >= TAKE_PROFIT_PCT:
        log.info(
            f"TAKE PROFIT: entry={entry_price:.6f} current={current_price:.6f} gain={gain:.1%}"
        )
        return True
    return False
