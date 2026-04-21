"""
Red Tip — 15m Backtest via Birdeye API
Fetches 15m candles directly, tests best strategies at actual bot timeframe.
~50 days of data (4800 candles).
"""

import json, time, requests
from math import sqrt

import os as _os
from pathlib import Path as _Path
_vault_path = _os.environ.get("VAULT_PATH", str(
    _Path.home() / ".openclaw" / "credentials" / "openclaw_vault.json"
))
with open(_vault_path) as _f:
    _vault = json.load(_f)
API_KEY = _vault.get("solana", {}).get("birdeye_api_key", "")
BASE    = "https://public-api.birdeye.so"

TOKENS = {
    "SOL":  "So11111111111111111111111111111111111111112",
    "JUP":  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    "RAY":  "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
    "JTO":  "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL",
    "BONK": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
}

START = 100.0
POS_SIZE = 0.90
# ~50 days back from Apr 9 2026
TIME_TO   = 1775692800
TIME_FROM = TIME_TO - (50 * 86400)


def fetch_ohlcv(mint, symbol):
    print(f"  Fetching {symbol}...")
    url = f"{BASE}/defi/v3/ohlcv"
    headers = {"X-API-KEY": API_KEY, "x-chain": "solana"}
    params = {
        "address": mint,
        "type": "15m",
        "time_from": TIME_FROM,
        "time_to": TIME_TO,
        "currency": "usd",
    }
    resp = requests.get(url, headers=headers, params=params, timeout=30)
    data = resp.json()
    items = data.get("data", {}).get("items", [])
    items.sort(key=lambda x: x.get("unix_time", x.get("unixTime", 0)))
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


def simulate(closes, highs, lows, entries, sl_pct, tp_pct):
    capital = START
    trades = []
    entry_idx = 0
    while entry_idx < len(entries):
        idx = entries[entry_idx]
        if capital < 50:
            break
        pos = capital * POS_SIZE
        ep = closes[idx]
        exited = False
        for j in range(idx + 1, len(closes)):
            sl = ep * (1 - sl_pct)
            tp = ep * (1 + tp_pct)
            if lows[j] <= sl:
                capital += pos * (-sl_pct)
                trades.append({"pnl": pos * (-sl_pct), "reason": "SL", "bars": j - idx})
                while entry_idx < len(entries) and entries[entry_idx] <= j:
                    entry_idx += 1
                exited = True
                break
            elif highs[j] >= tp:
                capital += pos * tp_pct
                trades.append({"pnl": pos * tp_pct, "reason": "TP", "bars": j - idx})
                while entry_idx < len(entries) and entries[entry_idx] <= j:
                    entry_idx += 1
                exited = True
                break
        if not exited:
            pnl_pct = (closes[-1] - ep) / ep
            capital += pos * pnl_pct
            trades.append({"pnl": pos * pnl_pct, "reason": "END", "bars": len(closes) - idx})
            entry_idx = len(entries)
    return trades, capital


def run_strategies(closes, highs, lows, volumes):
    results = {}
    e8 = ema_arr(closes, 8)
    e9 = ema_arr(closes, 9)
    e13 = ema_arr(closes, 13)
    e21 = ema_arr(closes, 21)
    e26 = ema_arr(closes, 26)
    e50 = ema_arr(closes, 50)
    e200 = ema_arr(closes, 200)
    rsi = rsi_arr(closes, 14)
    start = 205

    strategies = {}

    # 1. EMA 9/26 Crossover
    entries = []
    for i in range(start, len(closes)):
        if e50[i] <= e200[i]: continue
        if e9[i] <= e26[i]: continue
        if not (40 <= rsi[i] <= 60): continue
        if e9[i-1] <= e26[i-1] and e9[i] > e26[i]:
            entries.append(i)
    strategies["EMA Cross 9/26"] = entries

    # 2. Triple EMA 8/13/21
    entries = []
    for i in range(start, len(closes)):
        if e50[i] <= e200[i]: continue
        if e8[i] > e13[i] > e21[i]:
            if not (e8[i-1] > e13[i-1] > e21[i-1]):
                if 40 <= rsi[i] <= 65:
                    entries.append(i)
    strategies["Triple EMA 8/13/21"] = entries

    # 3. RSI Dip Buy (RSI < 35 bounce in uptrend)
    entries = []
    for i in range(start, len(closes)):
        if e50[i] <= e200[i]: continue
        if rsi[i-1] < 35 and rsi[i] >= 35:
            entries.append(i)
    strategies["RSI Dip <35"] = entries

    # 4. EMA Pullback to 21
    entries = []
    for i in range(start, len(closes)):
        if e50[i] <= e200[i]: continue
        if e9[i] <= e21[i]: continue
        dist = (closes[i] - e21[i]) / e21[i]
        if 0 < dist < 0.005 and lows[i] <= e21[i] * 1.003:
            if 40 <= rsi[i] < 60:
                entries.append(i)
    strategies["EMA21 Pullback"] = entries

    # 5. RSI Mean Reversion (< 30)
    entries = []
    for i in range(start, len(closes)):
        if e50[i] <= e200[i]: continue
        if rsi[i-1] < 30 and rsi[i] >= 30:
            entries.append(i)
    strategies["RSI Mean Rev <30"] = entries

    sl_tp_combos = [
        (0.015, 0.03, "1.5/3%"),
        (0.015, 0.045, "1.5/4.5%"),
        (0.02, 0.04, "2/4%"),
        (0.02, 0.06, "2/6%"),
        (0.02, 0.08, "2/8%"),
        (0.03, 0.06, "3/6%"),
    ]

    all_results = []
    for name, ents in strategies.items():
        for sl, tp, label in sl_tp_combos:
            trades, final = simulate(closes, highs, lows, ents, sl, tp)
            wins = sum(1 for t in trades if t["pnl"] > 0)
            total = len(trades)
            pnl = final - START
            # Scale monthly: 50 days of data -> multiply by 6 for monthly rate
            monthly = pnl / (50/30)
            avg_bars = sum(t["bars"] for t in trades) / total if total else 0
            all_results.append({
                "strategy": f"{name} | {label}",
                "trades": total, "wins": wins,
                "wr": wins/total*100 if total else 0,
                "pnl": pnl, "monthly": monthly,
                "final": final,
                "avg_bars": avg_bars,
                "entries_raw": len(ents),
            })

    return all_results


def main():
    t0 = time.time()
    print("Fetching 15m candle data from Birdeye (~50 days)...")

    all_results = []
    for sym, mint in TOKENS.items():
        candles = fetch_ohlcv(mint, sym)
        if not candles:
            print(f"  {sym}: NO DATA")
            continue
        print(f"  {sym}: {len(candles)} candles")

        closes = [c["c"] for c in candles]
        highs = [c["h"] for c in candles]
        lows = [c["l"] for c in candles]
        volumes = [c.get("v", 0) for c in candles]

        if len(candles) < 210:
            print(f"  {sym}: Not enough candles for EMA200 warmup")
            continue

        results = run_strategies(closes, highs, lows, volumes)
        for r in results:
            r["token"] = sym
            all_results.append(r)

    elapsed = time.time() - t0
    print(f"\nDone in {elapsed:.1f}s\n")

    # Per-token best
    for sym in TOKENS:
        token_results = [r for r in all_results if r["token"] == sym]
        if not token_results:
            continue
        token_results.sort(key=lambda x: x["pnl"], reverse=True)

        print(f"\n{'=' * 80}")
        print(f"{sym} — 15m BACKTEST (50 days)")
        print(f"{'=' * 80}")
        print(f"{'#':>3}  {'PnL':>8}  {'$/mo':>7}  {'WR%':>6}  {'#Trd':>5}  {'AvgBars':>7}  Strategy")
        print("-" * 80)
        for i, r in enumerate(token_results[:10]):
            print(f"{i+1:>3}  ${r['pnl']:>+7.2f}  ${r['monthly']:>+6.2f}  {r['wr']:>5.1f}%  "
                  f"{r['trades']:>5}  {r['avg_bars']:>7.1f}  {r['strategy']}")

    # Combined rankings
    from collections import defaultdict
    combined = defaultdict(lambda: {"pnl": 0, "trades": 0, "wins": 0, "tokens": {}})
    for r in all_results:
        key = r["strategy"]
        combined[key]["pnl"] += r["pnl"]
        combined[key]["trades"] += r["trades"]
        combined[key]["wins"] += r["wins"]
        combined[key]["tokens"][r["token"]] = r["pnl"]

    ranked = sorted(combined.items(), key=lambda x: x[1]["pnl"], reverse=True)

    print(f"\n{'=' * 95}")
    print("COMBINED ALL TOKENS — TOP 15")
    print(f"{'=' * 95}")
    hdr_tokens = "  ".join(f"{s:>7}" for s in TOKENS)
    print(f"{'#':>3}  {'PnL':>8}  {'$/mo':>7}  {'WR%':>6}  {'#Trd':>5}  {hdr_tokens}  Strategy")
    print("-" * 95)
    for i, (key, v) in enumerate(ranked[:15]):
        wr = v["wins"]/v["trades"]*100 if v["trades"] else 0
        mo = v["pnl"] / (50/30)
        tvals = "  ".join(f"${v['tokens'].get(s,0):>+6.1f}" for s in TOKENS)
        print(f"{i+1:>3}  ${v['pnl']:>+7.2f}  ${mo:>+6.2f}  {wr:>5.1f}%  "
              f"{v['trades']:>5}  {tvals}  {key}")

    # Profitable on 3+ tokens
    multi_profit = [(k, v) for k, v in ranked
                    if sum(1 for t in v["tokens"].values() if t > 0) >= 3]
    if multi_profit:
        print(f"\n{'=' * 80}")
        print(f"PROFITABLE ON 3+ TOKENS ({len(multi_profit)} configs)")
        print("=" * 80)
        for i, (key, v) in enumerate(multi_profit[:10]):
            tvals = " ".join(f"{s}:${v['tokens'][s]:>+.1f}" for s in v["tokens"] if v["tokens"][s] > 0)
            print(f"  {i+1}. ${v['pnl']:>+.2f} total  {tvals}  {key}")

    print()


if __name__ == "__main__":
    main()
