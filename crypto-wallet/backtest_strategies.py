"""
Red Tip — Multi-Strategy Backtest
Tests 4 fundamentally different strategies on SOL 1H data (6 months).
Goal: find highest trade frequency + profitability on $100 capital.
"""

import json, time
from math import sqrt

SOL_FILE = "data/sol_ohlcv.txt"
BONK_FILE = "data/bonk_ohlcv.txt"
WIF_FILE = "data/wif_ohlcv.txt"

START = 100.0
POS_SIZE = 0.90


def load(path):
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)
    text = next((x["text"] for x in raw if x.get("type") == "text"), None)
    if text.startswith("API Response"):
        text = text[text.find("\n") + 1:]
    items = json.loads(text).get("data", {}).get("items", [])
    items.sort(key=lambda x: x.get("unix_time", 0))
    return items


def ema_arr(prices, p):
    k = 2 / (p + 1)
    o = [prices[0]]
    for x in prices[1:]:
        o.append(x * k + o[-1] * (1 - k))
    return o


def rsi_arr(prices, p=14):
    n = len(prices)
    o = [50.0] * n
    if n < p + 1:
        return o
    d = [prices[i] - prices[i-1] for i in range(1, n)]
    ag = sum(max(x, 0) for x in d[:p]) / p
    al = sum(max(-x, 0) for x in d[:p]) / p
    o[p] = 100.0 if al == 0 else 100 - 100 / (1 + ag / al)
    for i in range(p, len(d)):
        ag = (ag * (p - 1) + max(d[i], 0)) / p
        al = (al * (p - 1) + max(-d[i], 0)) / p
        o[i + 1] = 100.0 if al == 0 else 100 - 100 / (1 + ag / al)
    return o


def bb_arr(prices, period=20, mult=2.0):
    """Bollinger Bands: returns (upper, middle, lower) arrays."""
    n = len(prices)
    upper = [0.0] * n
    middle = [0.0] * n
    lower = [0.0] * n
    for i in range(period - 1, n):
        window = prices[i - period + 1:i + 1]
        sma = sum(window) / period
        std = sqrt(sum((x - sma) ** 2 for x in window) / period)
        middle[i] = sma
        upper[i] = sma + mult * std
        lower[i] = sma - mult * std
    return upper, middle, lower


def vol_sma(volumes, period=20):
    n = len(volumes)
    o = [0.0] * n
    for i in range(period - 1, n):
        o[i] = sum(volumes[i - period + 1:i + 1]) / period
    return o


def simulate(closes, highs, lows, entries, sl_pct, tp_pct):
    """Given entry indices, simulate trades with SL/TP. Returns trade list."""
    capital = START
    trades = []
    i = 0
    entry_idx = 0

    while entry_idx < len(entries):
        idx = entries[entry_idx]
        if capital < 50:
            break

        pos = capital * POS_SIZE
        ep = closes[idx]

        # Walk forward to find exit
        exited = False
        for j in range(idx + 1, len(closes)):
            sl = ep * (1 - sl_pct)
            tp = ep * (1 + tp_pct)

            if lows[j] <= sl:
                pnl = pos * (-sl_pct)
                capital += pnl
                trades.append({"pnl": pnl, "pnl_pct": -sl_pct, "reason": "SL", "bars": j - idx})
                # Skip entries before exit
                while entry_idx < len(entries) and entries[entry_idx] <= j:
                    entry_idx += 1
                exited = True
                break
            elif highs[j] >= tp:
                pnl = pos * tp_pct
                capital += pnl
                trades.append({"pnl": pnl, "pnl_pct": tp_pct, "reason": "TP", "bars": j - idx})
                while entry_idx < len(entries) and entries[entry_idx] <= j:
                    entry_idx += 1
                exited = True
                break

        if not exited:
            # Close at last candle
            pnl_pct = (closes[-1] - ep) / ep
            pnl = pos * pnl_pct
            capital += pnl
            trades.append({"pnl": pnl, "pnl_pct": pnl_pct, "reason": "END", "bars": len(closes) - idx})
            entry_idx = len(entries)

    return trades, capital


def report(name, trades, final, months=6):
    wins = [t for t in trades if t["pnl"] > 0]
    losses = [t for t in trades if t["pnl"] <= 0]
    total = len(trades)
    wr = len(wins) / total * 100 if total else 0
    pnl = sum(t["pnl"] for t in trades)
    avg_bars = sum(t["bars"] for t in trades) / total if total else 0
    monthly = pnl / months if months else 0

    peak = START
    cap = START
    max_dd = 0
    for t in trades:
        cap += t["pnl"]
        if cap > peak:
            peak = cap
        dd = (peak - cap) / peak * 100 if peak > 0 else 0
        if dd > max_dd:
            max_dd = dd

    print(f"\n{'=' * 65}")
    print(f"  {name}")
    print(f"{'=' * 65}")
    print(f"  Trades:      {total:>5}  ({len(wins)}W / {len(losses)}L)")
    print(f"  Win Rate:    {wr:>5.1f}%")
    print(f"  Total PnL:   ${pnl:>+8.2f}  ({pnl/START*100:>+.1f}%)")
    print(f"  Monthly:     ${monthly:>+8.2f}/mo")
    print(f"  Final Cap:   ${final:>8.2f}")
    print(f"  Max DD:      {max_dd:>5.1f}%")
    print(f"  Avg Hold:    {avg_bars:>5.1f} bars")
    print(f"  Trades/mo:   {total/months:>5.1f}")
    return {"name": name, "trades": total, "pnl": pnl, "monthly": monthly,
            "wr": wr, "max_dd": max_dd, "final": final}


# ─── STRATEGIES ────────────────────────────────────────────────────────────────

def strategy_ema_crossover(closes, highs, lows, sl, tp):
    """Current strategy: EMA 9/26 cross + EMA 50>200 + RSI 40-60"""
    e9 = ema_arr(closes, 9)
    e26 = ema_arr(closes, 26)
    e50 = ema_arr(closes, 50)
    e200 = ema_arr(closes, 200)
    rsi = rsi_arr(closes, 14)

    entries = []
    for i in range(205, len(closes)):
        if e50[i] <= e200[i]:
            continue
        if e9[i] <= e26[i]:
            continue
        if not (40 <= rsi[i] <= 60):
            continue
        if e9[i-1] <= e26[i-1] and e9[i] > e26[i]:
            entries.append(i)
    return simulate(closes, highs, lows, entries, sl, tp)


def strategy_rsi_mean_reversion(closes, highs, lows, sl, tp):
    """Buy when RSI < 30 in uptrend (EMA50>200), sell at TP/SL."""
    e50 = ema_arr(closes, 50)
    e200 = ema_arr(closes, 200)
    rsi = rsi_arr(closes, 14)

    entries = []
    for i in range(205, len(closes)):
        if e50[i] <= e200[i]:
            continue
        # RSI oversold bounce: RSI was < 30 and now crossing back above 30
        if rsi[i-1] < 30 and rsi[i] >= 30:
            entries.append(i)
    return simulate(closes, highs, lows, entries, sl, tp)


def strategy_rsi_dip_buy(closes, highs, lows, sl, tp):
    """Buy when RSI < 35 in uptrend. More signals than strict < 30."""
    e50 = ema_arr(closes, 50)
    e200 = ema_arr(closes, 200)
    rsi = rsi_arr(closes, 14)

    entries = []
    for i in range(205, len(closes)):
        if e50[i] <= e200[i]:
            continue
        if rsi[i-1] < 35 and rsi[i] >= 35:
            entries.append(i)
    return simulate(closes, highs, lows, entries, sl, tp)


def strategy_bb_bounce(closes, highs, lows, sl, tp):
    """Buy lower Bollinger Band touch in uptrend."""
    e50 = ema_arr(closes, 50)
    e200 = ema_arr(closes, 200)
    _, _, bb_low = bb_arr(closes, 20, 2.0)
    rsi = rsi_arr(closes, 14)

    entries = []
    for i in range(205, len(closes)):
        if e50[i] <= e200[i]:
            continue
        if bb_low[i] == 0:
            continue
        # Price touched or broke below lower band and RSI < 40
        if lows[i] <= bb_low[i] and rsi[i] < 40:
            entries.append(i)
    return simulate(closes, highs, lows, entries, sl, tp)


def strategy_volume_breakout(closes, highs, lows, volumes, sl, tp):
    """Volume spike + price breakout above 20-period high."""
    e50 = ema_arr(closes, 50)
    e200 = ema_arr(closes, 200)
    vsma = vol_sma(volumes, 20)
    rsi = rsi_arr(closes, 14)

    entries = []
    for i in range(205, len(closes)):
        if e50[i] <= e200[i]:
            continue
        if vsma[i] == 0:
            continue
        # Volume 2x above average
        if volumes[i] < vsma[i] * 2.0:
            continue
        # Price breaking above 10-period high
        recent_high = max(highs[i-10:i])
        if closes[i] > recent_high and 40 <= rsi[i] <= 70:
            entries.append(i)
    return simulate(closes, highs, lows, entries, sl, tp)


def strategy_ema_pullback(closes, highs, lows, sl, tp):
    """In uptrend, buy when price pulls back to EMA21 (support bounce)."""
    e9 = ema_arr(closes, 9)
    e21 = ema_arr(closes, 21)
    e50 = ema_arr(closes, 50)
    e200 = ema_arr(closes, 200)
    rsi = rsi_arr(closes, 14)

    entries = []
    for i in range(205, len(closes)):
        if e50[i] <= e200[i]:
            continue
        if e9[i] <= e21[i]:
            continue
        # Price pulled back to within 0.5% of EMA21 and bouncing
        dist = (closes[i] - e21[i]) / e21[i]
        if 0 < dist < 0.005 and lows[i] <= e21[i] * 1.003:
            if rsi[i] > 40 and rsi[i] < 60:
                entries.append(i)
    return simulate(closes, highs, lows, entries, sl, tp)


def strategy_triple_ema(closes, highs, lows, sl, tp):
    """EMA 8/13/21 alignment + RSI momentum. Fast signals."""
    e8 = ema_arr(closes, 8)
    e13 = ema_arr(closes, 13)
    e21 = ema_arr(closes, 21)
    e50 = ema_arr(closes, 50)
    e200 = ema_arr(closes, 200)
    rsi = rsi_arr(closes, 14)

    entries = []
    for i in range(205, len(closes)):
        if e50[i] <= e200[i]:
            continue
        # All 3 EMAs aligned: 8 > 13 > 21
        if e8[i] > e13[i] > e21[i]:
            # Fresh alignment: wasn't aligned previous bar
            if not (e8[i-1] > e13[i-1] > e21[i-1]):
                if 40 <= rsi[i] <= 65:
                    entries.append(i)
    return simulate(closes, highs, lows, entries, sl, tp)


def main():
    t0 = time.time()

    # Load all token data
    tokens = {}
    for sym, path in [("SOL", SOL_FILE), ("BONK", BONK_FILE), ("WIF", WIF_FILE)]:
        c = load(path)
        tokens[sym] = {
            "closes": [x["c"] for x in c],
            "highs": [x["h"] for x in c],
            "lows": [x["l"] for x in c],
            "volumes": [x.get("v", 0) for x in c],
        }
        print(f"Loaded {sym}: {len(c)} candles")

    # Test each strategy with multiple SL/TP combos on each token
    sl_tp_combos = [
        (0.02, 0.04, "2%/4%"),
        (0.02, 0.06, "2%/6%"),
        (0.03, 0.06, "3%/6%"),
        (0.02, 0.08, "2%/8%"),
        (0.015, 0.03, "1.5%/3%"),
        (0.015, 0.045, "1.5%/4.5%"),
    ]

    all_results = []

    for sym, data in tokens.items():
        c, h, l, v = data["closes"], data["highs"], data["lows"], data["volumes"]

        strategies = [
            ("EMA 9/26 Cross", lambda sl, tp: strategy_ema_crossover(c, h, l, sl, tp)),
            ("RSI<30 Mean Rev", lambda sl, tp: strategy_rsi_mean_reversion(c, h, l, sl, tp)),
            ("RSI<35 Dip Buy", lambda sl, tp: strategy_rsi_dip_buy(c, h, l, sl, tp)),
            ("BB Bounce", lambda sl, tp: strategy_bb_bounce(c, h, l, sl, tp)),
            ("Vol Breakout", lambda sl, tp: strategy_volume_breakout(c, h, l, v, sl, tp)),
            ("EMA Pullback", lambda sl, tp: strategy_ema_pullback(c, h, l, sl, tp)),
            ("Triple EMA", lambda sl, tp: strategy_triple_ema(c, h, l, sl, tp)),
        ]

        for strat_name, strat_fn in strategies:
            for sl, tp, label in sl_tp_combos:
                trades, final = strat_fn(sl, tp)
                pnl = final - START
                wins = sum(1 for t in trades if t["pnl"] > 0)
                total = len(trades)
                wr = wins / total * 100 if total else 0
                monthly = pnl / 6
                peak = START
                cap = START
                max_dd = 0
                for t in trades:
                    cap += t["pnl"]
                    if cap > peak: peak = cap
                    dd = (peak - cap) / peak * 100 if peak > 0 else 0
                    if dd > max_dd: max_dd = dd

                all_results.append({
                    "token": sym, "strategy": strat_name, "sl_tp": label,
                    "trades": total, "wins": wins, "wr": wr,
                    "pnl": pnl, "monthly": monthly, "max_dd": max_dd,
                    "final": final,
                })

    elapsed = time.time() - t0
    print(f"\nRan {len(all_results)} combinations in {elapsed:.1f}s\n")

    # ─── COMBINED RANKINGS ─────────────────────────────────────────────────
    # Group by strategy+sl_tp, sum PnL across tokens
    from collections import defaultdict
    combined = defaultdict(lambda: {"pnl": 0, "trades": 0, "wins": 0, "max_dd": 0, "tokens": {}})
    for r in all_results:
        key = f"{r['strategy']} | {r['sl_tp']}"
        combined[key]["pnl"] += r["pnl"]
        combined[key]["trades"] += r["trades"]
        combined[key]["wins"] += r["wins"]
        combined[key]["max_dd"] = max(combined[key]["max_dd"], r["max_dd"])
        combined[key]["tokens"][r["token"]] = r["pnl"]

    ranked = sorted(combined.items(), key=lambda x: x[1]["pnl"], reverse=True)

    print("=" * 90)
    print("TOP 20 STRATEGY + PARAMS (combined PnL: SOL+BONK+WIF)")
    print("=" * 90)
    print(f"{'#':>3}  {'PnL':>8}  {'WR%':>6}  {'#Trd':>5}  {'$/mo':>7}  {'MaxDD':>6}  {'SOL':>7}  {'BONK':>7}  {'WIF':>7}  Strategy")
    print("-" * 90)
    for i, (key, v) in enumerate(ranked[:20]):
        wr = v["wins"] / v["trades"] * 100 if v["trades"] else 0
        mo = v["pnl"] / 6
        t = v["tokens"]
        print(f"{i+1:>3}  ${v['pnl']:>+7.2f}  {wr:>5.1f}%  {v['trades']:>5}  ${mo:>+6.2f}  {v['max_dd']:>5.1f}%  "
              f"${t.get('SOL',0):>+6.1f}  ${t.get('BONK',0):>+6.1f}  ${t.get('WIF',0):>+6.1f}  {key}")

    # ─── SOL-ONLY RANKINGS ─────────────────────────────────────────────────
    sol_only = [r for r in all_results if r["token"] == "SOL"]
    sol_only.sort(key=lambda x: x["pnl"], reverse=True)

    print(f"\n{'=' * 80}")
    print("SOL-ONLY TOP 15")
    print("=" * 80)
    print(f"{'#':>3}  {'PnL':>8}  {'WR%':>6}  {'#Trd':>5}  {'$/mo':>7}  {'MaxDD':>6}  Strategy")
    print("-" * 80)
    for i, r in enumerate(sol_only[:15]):
        mo = r["pnl"] / 6
        print(f"{i+1:>3}  ${r['pnl']:>+7.2f}  {r['wr']:>5.1f}%  {r['trades']:>5}  ${mo:>+6.2f}  "
              f"{r['max_dd']:>5.1f}%  {r['strategy']} | {r['sl_tp']}")

    # ─── BEST STRATEGY DETAILED BREAKDOWN ──────────────────────────────────
    if ranked:
        best_key = ranked[0][0]
        print(f"\n{'=' * 80}")
        print(f"BEST OVERALL: {best_key}")
        print("=" * 80)
        for r in all_results:
            k = f"{r['strategy']} | {r['sl_tp']}"
            if k == best_key:
                print(f"  {r['token']:>6}: {r['trades']:>3}T  WR={r['wr']:>5.1f}%  "
                      f"PnL=${r['pnl']:>+7.2f}  ${r['monthly']:>+.2f}/mo  MaxDD={r['max_dd']:.1f}%")

    # ─── PROFITABLE ACROSS ALL 3 ──────────────────────────────────────────
    all3 = [(k, v) for k, v in ranked if all(v["tokens"].get(s, -1) > 0 for s in ["SOL","BONK","WIF"])]
    if all3:
        print(f"\n{'=' * 80}")
        print(f"PROFITABLE ON ALL 3 TOKENS ({len(all3)} configs)")
        print("=" * 80)
        for i, (key, v) in enumerate(all3[:10]):
            wr = v["wins"] / v["trades"] * 100 if v["trades"] else 0
            t = v["tokens"]
            print(f"  {i+1}. ${v['pnl']:>+.2f} total  ${v['pnl']/6:>+.2f}/mo  "
                  f"SOL=${t['SOL']:>+.1f} BONK=${t['BONK']:>+.1f} WIF=${t['WIF']:>+.1f}  {key}")
    else:
        print("\nNo strategy profitable on all 3 tokens.")

    # ─── HIGHEST TRADE FREQUENCY (profitable only) ────────────────────────
    profitable = [(k, v) for k, v in ranked if v["pnl"] > 0]
    if profitable:
        profitable.sort(key=lambda x: x[1]["trades"], reverse=True)
        print(f"\n{'=' * 80}")
        print("MOST ACTIVE PROFITABLE STRATEGIES")
        print("=" * 80)
        for i, (key, v) in enumerate(profitable[:10]):
            wr = v["wins"] / v["trades"] * 100 if v["trades"] else 0
            print(f"  {i+1}. {v['trades']:>4} trades  ${v['pnl']:>+.2f}  "
                  f"${v['pnl']/6:>+.2f}/mo  WR={wr:.1f}%  {key}")

    print()


if __name__ == "__main__":
    main()
