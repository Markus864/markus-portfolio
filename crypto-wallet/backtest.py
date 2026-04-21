"""
Red Tip Trading Bot v2 — 6-Month Backtest
Strategy: EMA 9/21 crossover + EMA 50/200 trend gate + RSI
Timeframe: 1H candles | Oct 9 2025 → Apr 9 2026
Tokens: SOL, BONK, WIF
Capital: $100 USDC | Position: 90% | SL: 3% | TP: 6%
"""

import json
import sys
from pathlib import Path

# ─── Config ────────────────────────────────────────────────────────────────────
EMA_FAST          = 9
EMA_SLOW          = 21
EMA_TREND_FAST    = 50
EMA_TREND_SLOW    = 200
RSI_PERIOD        = 14
RSI_MIN           = 40
RSI_MAX           = 70
EMA_CROSS_LOOKBACK = 2
STOP_LOSS_PCT     = 0.03
TAKE_PROFIT_PCT   = 0.06
POSITION_SIZE_PCT = 0.90
START_CAPITAL     = 100.0
KILL_SWITCH_FLOOR = 50.0

DATA_FILES = {
    "SOL":  "data/sol_ohlcv.txt",
    "BONK": "data/bonk_ohlcv.txt",
    "WIF":  "data/wif_ohlcv.txt",
}


# ─── Indicators ────────────────────────────────────────────────────────────────
def ema(prices, period):
    k = 2 / (period + 1)
    result = [prices[0]]
    for p in prices[1:]:
        result.append(p * k + result[-1] * (1 - k))
    return result


def rsi(prices, period=14):
    if len(prices) < period + 1:
        return 50.0
    deltas = [prices[i] - prices[i-1] for i in range(1, len(prices))]
    gains  = [d if d > 0 else 0.0 for d in deltas]
    losses = [-d if d < 0 else 0.0 for d in deltas]
    ag = sum(gains[:period]) / period
    al = sum(losses[:period]) / period
    for i in range(period, len(gains)):
        ag = (ag * (period - 1) + gains[i]) / period
        al = (al * (period - 1) + losses[i]) / period
    if al == 0:
        return 100.0
    return 100 - (100 / (1 + ag / al))


# ─── Data Loading ──────────────────────────────────────────────────────────────
def load_candles(path):
    """Parse MCP tool-result file → list of {unixTime, o, h, l, c, v}"""
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    # MCP format: [{type: "text", text: "..."}, ...]
    # The actual JSON payload is in the first text element
    text = None
    if isinstance(raw, list) and len(raw) > 0:
        for item in raw:
            if isinstance(item, dict) and item.get("type") == "text":
                text = item["text"]
                break

    if text is None:
        print(f"ERROR: Could not find text content in {path}")
        return []

    # Strip "API Response (Status: 200):\n" prefix if present
    if text.startswith("API Response"):
        newline_idx = text.find("\n")
        if newline_idx != -1:
            text = text[newline_idx + 1:]

    payload = json.loads(text)
    # Birdeye response: {"data": {"items": [...]}}
    if isinstance(payload, dict):
        items = payload.get("data", {}).get("items", [])
        if not items:
            items = payload.get("items", [])
    else:
        items = payload

    # Normalize field names (unix_time or unixTime)
    for c in items:
        if "unix_time" in c and "unixTime" not in c:
            c["unixTime"] = c["unix_time"]

    # Sort by time ascending
    items.sort(key=lambda x: x.get("unixTime", 0))
    return items


# ─── Signal Detection ──────────────────────────────────────────────────────────
def check_signal(closes, idx):
    """
    Check signal at candle index `idx`.
    Uses all candles up to and including idx.
    Returns True if all conditions met.
    """
    window = closes[:idx + 1]
    if len(window) < EMA_TREND_SLOW + 5:
        return False, {}

    e_fast     = ema(window, EMA_FAST)
    e_slow     = ema(window, EMA_SLOW)
    e_t_fast   = ema(window, EMA_TREND_FAST)
    e_t_slow   = ema(window, EMA_TREND_SLOW)
    rsi_val    = rsi(window, RSI_PERIOD)

    macro_bull = e_t_fast[-1] > e_t_slow[-1]

    crossed = False
    for i in range(1, EMA_CROSS_LOOKBACK + 2):
        if len(e_fast) > i + 1:
            if e_fast[-(i+1)] <= e_slow[-(i+1)] and e_fast[-i] > e_slow[-i]:
                crossed = True
                break

    trend_up = e_fast[-1] > e_slow[-1]
    rsi_ok   = RSI_MIN <= rsi_val <= RSI_MAX

    signal = macro_bull and crossed and trend_up and rsi_ok
    return signal, {
        "macro_bull": macro_bull,
        "crossed": crossed,
        "trend_up": trend_up,
        "rsi_ok": rsi_ok,
        "rsi": rsi_val,
        "ema9": e_fast[-1],
        "ema21": e_slow[-1],
        "ema50": e_t_fast[-1],
        "ema200": e_t_slow[-1],
    }


# ─── Backtest Engine ───────────────────────────────────────────────────────────
def backtest_token(symbol, candles):
    """Simulate trading on a single token's candle history."""
    closes    = [c["c"] for c in candles]
    highs     = [c["h"] for c in candles]
    lows      = [c["l"] for c in candles]
    times     = [c["unixTime"] for c in candles]

    capital   = START_CAPITAL
    trades    = []
    in_pos    = False
    entry_price = 0.0
    entry_idx   = 0
    position_usdc = 0.0

    for i in range(EMA_TREND_SLOW + 5, len(candles)):
        if capital < KILL_SWITCH_FLOOR and not in_pos:
            break

        if not in_pos:
            signal, meta = check_signal(closes, i)
            if signal:
                position_usdc = capital * POSITION_SIZE_PCT
                entry_price   = closes[i]
                entry_idx     = i
                in_pos        = True
        else:
            # Check TP/SL using high/low of current candle for realism
            sl_price = entry_price * (1 - STOP_LOSS_PCT)
            tp_price = entry_price * (1 + TAKE_PROFIT_PCT)

            hit_sl = lows[i] <= sl_price
            hit_tp = highs[i] >= tp_price

            # If both hit same candle, conservative: assume SL hit first
            if hit_sl or hit_tp:
                if hit_sl and hit_tp:
                    exit_price = sl_price
                    reason = "stop_loss"
                elif hit_tp:
                    exit_price = tp_price
                    reason = "take_profit"
                else:
                    exit_price = sl_price
                    reason = "stop_loss"

                pnl_pct = (exit_price - entry_price) / entry_price
                pnl_usd = position_usdc * pnl_pct
                capital += pnl_usd

                from datetime import datetime, timezone
                entry_dt = datetime.fromtimestamp(times[entry_idx], tz=timezone.utc).strftime("%Y-%m-%d %H:%M")
                exit_dt  = datetime.fromtimestamp(times[i], tz=timezone.utc).strftime("%Y-%m-%d %H:%M")

                trades.append({
                    "entry_time":   entry_dt,
                    "exit_time":    exit_dt,
                    "entry_price":  entry_price,
                    "exit_price":   exit_price,
                    "reason":       reason,
                    "pnl_pct":      pnl_pct * 100,
                    "pnl_usd":      pnl_usd,
                    "capital_after": capital,
                })
                in_pos = False

    # Force close any open position at last candle
    if in_pos:
        exit_price = closes[-1]
        pnl_pct    = (exit_price - entry_price) / entry_price
        pnl_usd    = position_usdc * pnl_pct
        capital   += pnl_usd
        from datetime import datetime, timezone
        exit_dt = datetime.fromtimestamp(times[-1], tz=timezone.utc).strftime("%Y-%m-%d %H:%M")
        trades.append({
            "entry_time":   datetime.fromtimestamp(times[entry_idx], tz=timezone.utc).strftime("%Y-%m-%d %H:%M"),
            "exit_time":    exit_dt,
            "entry_price":  entry_price,
            "exit_price":   exit_price,
            "reason":       "end_of_data",
            "pnl_pct":      pnl_pct * 100,
            "pnl_usd":      pnl_usd,
            "capital_after": capital,
        })

    return trades, capital


# ─── Report ────────────────────────────────────────────────────────────────────
def print_report(symbol, trades, final_capital):
    wins   = [t for t in trades if t["pnl_usd"] > 0]
    losses = [t for t in trades if t["pnl_usd"] <= 0]
    total  = len(trades)
    win_rate = len(wins) / total * 100 if total else 0
    total_pnl = sum(t["pnl_usd"] for t in trades)
    avg_win  = sum(t["pnl_usd"] for t in wins)  / len(wins)  if wins   else 0
    avg_loss = sum(t["pnl_usd"] for t in losses) / len(losses) if losses else 0
    max_drawdown = 0
    peak = START_CAPITAL
    for t in trades:
        cap = t["capital_after"]
        if cap > peak:
            peak = cap
        dd = (peak - cap) / peak * 100
        if dd > max_drawdown:
            max_drawdown = dd

    print(f"\n{'='*58}")
    print(f"  {symbol} — 6-Month Backtest (1H | Oct 2025 → Apr 2026)")
    print(f"{'='*58}")
    print(f"  Trades:       {total:>6}  ({len(wins)} wins / {len(losses)} losses)")
    print(f"  Win Rate:     {win_rate:>6.1f}%")
    print(f"  Total P&L:    ${total_pnl:>+8.2f}")
    print(f"  Start:        ${START_CAPITAL:>8.2f}")
    print(f"  End:          ${final_capital:>8.2f}")
    print(f"  Return:       {(final_capital - START_CAPITAL) / START_CAPITAL * 100:>+7.1f}%")
    print(f"  Avg Win:      ${avg_win:>+8.2f}")
    print(f"  Avg Loss:     ${avg_loss:>+8.2f}")
    print(f"  Max Drawdown: {max_drawdown:>6.1f}%")

    if trades:
        print(f"\n  --- Trade Log ---")
        print(f"  {'Date':>16}  {'Reason':>12}  {'P&L%':>6}  {'P&L$':>8}  {'Cap':>8}")
        for t in trades:
            tag = "WIN " if t["pnl_usd"] > 0 else "LOSS"
            print(f"  [{tag}] {t['entry_time']}  {t['reason']:>12}  "
                  f"{t['pnl_pct']:>+6.2f}%  ${t['pnl_usd']:>+7.2f}  ${t['capital_after']:>7.2f}")


# ─── Main ──────────────────────────────────────────────────────────────────────
def main():
    print("\nRED TIP TRADING BOT v2 — BACKTEST ENGINE")
    print("Strategy: EMA 9/21 + EMA 50/200 + RSI | 3% SL / 6% TP")
    print("Period: Oct 9 2025 -> Apr 9 2026 | Timeframe: 1H candles")

    all_trades = []
    summary = {}

    for symbol, path in DATA_FILES.items():
        print(f"\nLoading {symbol} candles from file...")
        candles = load_candles(path)
        if not candles:
            print(f"  ERROR: No candles loaded for {symbol}")
            continue
        print(f"  Loaded {len(candles)} candles")

        trades, final_cap = backtest_token(symbol, candles)
        print_report(symbol, trades, final_cap)
        all_trades.extend(trades)
        summary[symbol] = {"trades": len(trades), "final": final_cap,
                           "pnl": final_cap - START_CAPITAL}

    # Combined summary
    print(f"\n{'='*58}")
    print("  COMBINED SUMMARY")
    print(f"{'='*58}")
    for sym, s in summary.items():
        print(f"  {sym:>6}  {s['trades']:>3} trades  ${s['pnl']:>+8.2f}  "
              f"→ ${s['final']:.2f}")

    # Strategy recommendation
    print(f"\n{'='*58}")
    print("  STRATEGY RECOMMENDATION")
    print(f"{'='*58}")
    if summary:
        best = max(summary, key=lambda k: summary[k]["pnl"])
        worst = min(summary, key=lambda k: summary[k]["pnl"])
        print(f"  Best token:   {best} (${summary[best]['pnl']:+.2f})")
        print(f"  Worst token:  {worst} (${summary[worst]['pnl']:+.2f})")

        profitable = [s for s, v in summary.items() if v["pnl"] > 0]
        if profitable:
            print(f"  Profitable:   {', '.join(profitable)}")
            print(f"  Recommendation: Run bot on {', '.join(profitable)}")
        else:
            print("  WARNING: No token was profitable with current params.")
            print("  Consider: tighter RSI range, longer EMA cross lookback,")
            print("  or add volume filter before going live.")

    print()


if __name__ == "__main__":
    main()
