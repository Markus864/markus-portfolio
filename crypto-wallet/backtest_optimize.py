"""
Red Tip Trading Bot v2 — FAST Parameter Optimization
Precomputes all EMA/RSI arrays once per token, then sweeps configs.
"""

import json, time

DATA_FILES = {
    "SOL":  "data/sol_ohlcv.txt",
    "BONK": "data/bonk_ohlcv.txt",
    "WIF":  "data/wif_ohlcv.txt",
}

START_CAPITAL = 100.0
KILL_FLOOR    = 50.0


def ema_full(prices, period):
    """Compute full EMA array in one pass."""
    k = 2 / (period + 1)
    out = [0.0] * len(prices)
    out[0] = prices[0]
    for i in range(1, len(prices)):
        out[i] = prices[i] * k + out[i-1] * (1 - k)
    return out


def rsi_full(prices, period=14):
    """Compute RSI for every index in one pass. Returns array same length as prices."""
    n = len(prices)
    out = [50.0] * n
    if n < period + 1:
        return out
    deltas = [prices[i] - prices[i-1] for i in range(1, n)]
    ag = sum(max(d, 0) for d in deltas[:period]) / period
    al = sum(max(-d, 0) for d in deltas[:period]) / period
    out[period] = 100.0 if al == 0 else 100 - (100 / (1 + ag / al))
    for i in range(period, len(deltas)):
        ag = (ag * (period - 1) + max(deltas[i], 0)) / period
        al = (al * (period - 1) + max(-deltas[i], 0)) / period
        out[i + 1] = 100.0 if al == 0 else 100 - (100 / (1 + ag / al))
    return out


def load_candles(path):
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)
    text = next((x["text"] for x in raw if x.get("type") == "text"), None)
    if not text:
        return []
    if text.startswith("API Response"):
        text = text[text.find("\n") + 1:]
    items = json.loads(text).get("data", {}).get("items", [])
    items.sort(key=lambda x: x.get("unix_time", 0))
    return items


def precompute(candles):
    """Precompute all needed indicator arrays for a token."""
    closes = [c["c"] for c in candles]
    highs  = [c["h"] for c in candles]
    lows   = [c["l"] for c in candles]
    return {
        "closes": closes,
        "highs":  highs,
        "lows":   lows,
        "ema8":   ema_full(closes, 8),
        "ema9":   ema_full(closes, 9),
        "ema21":  ema_full(closes, 21),
        "ema26":  ema_full(closes, 26),
        "ema50":  ema_full(closes, 50),
        "ema200": ema_full(closes, 200),
        "rsi14":  rsi_full(closes, 14),
    }


def backtest(data, cfg):
    """Run backtest using precomputed arrays."""
    n = len(data["closes"])
    ema_f_key = f"ema{cfg['ema_fast']}"
    ema_s_key = f"ema{cfg['ema_slow']}"
    ef  = data[ema_f_key]
    es  = data[ema_s_key]
    etf = data["ema50"]
    ets = data["ema200"]
    rsi_arr = data["rsi14"]
    closes = data["closes"]
    highs  = data["highs"]
    lows   = data["lows"]

    sl_pct   = cfg["sl"]
    tp_pct   = cfg["tp"]
    rsi_min  = cfg["rsi_min"]
    rsi_max  = cfg["rsi_max"]
    lookback = cfg["lookback"]
    pos_size = 0.90
    start_idx = 205  # EMA200 warmup

    capital = START_CAPITAL
    wins = 0
    losses = 0
    in_pos = False
    entry_price = 0.0
    pos_usdc = 0.0
    peak = START_CAPITAL
    max_dd = 0.0

    for i in range(start_idx, n):
        if capital < KILL_FLOOR and not in_pos:
            break

        if not in_pos:
            # Macro trend gate
            if etf[i] <= ets[i]:
                continue
            # Trend up
            if ef[i] <= es[i]:
                continue
            # RSI filter
            r = rsi_arr[i]
            if r < rsi_min or r > rsi_max:
                continue
            # Crossover check
            crossed = False
            for k in range(1, lookback + 2):
                if i > k and ef[i-k] > es[i-k] and ef[i-k-1] <= es[i-k-1]:
                    crossed = True
                    break
            if not crossed:
                continue

            pos_usdc = capital * pos_size
            entry_price = closes[i]
            in_pos = True
        else:
            sl = entry_price * (1 - sl_pct)
            tp = entry_price * (1 + tp_pct)
            hit_sl = lows[i] <= sl
            hit_tp = highs[i] >= tp

            if hit_sl or hit_tp:
                if hit_sl:
                    pnl = pos_usdc * (-sl_pct)
                    losses += 1
                else:
                    pnl = pos_usdc * tp_pct
                    wins += 1
                capital += pnl
                if capital > peak:
                    peak = capital
                dd = (peak - capital) / peak * 100 if peak > 0 else 0
                if dd > max_dd:
                    max_dd = dd
                in_pos = False

    # Close open position
    if in_pos:
        pnl_pct = (closes[-1] - entry_price) / entry_price
        capital += pos_usdc * pnl_pct
        if pnl_pct > 0:
            wins += 1
        else:
            losses += 1

    total = wins + losses
    return {
        "trades":   total,
        "wins":     wins,
        "win_rate": wins / total * 100 if total else 0,
        "pnl":      capital - START_CAPITAL,
        "final":    capital,
        "max_dd":   max_dd,
    }


def main():
    t0 = time.time()
    print("Loading + precomputing indicators...")
    token_data = {}
    for sym, path in DATA_FILES.items():
        candles = load_candles(path)
        token_data[sym] = precompute(candles)
        print(f"  {sym}: {len(candles)} candles precomputed")

    # Parameter grid
    configs = []
    for sl in [0.02, 0.025, 0.03, 0.04]:
        for tp_ratio in [2, 3, 4]:
            tp = round(sl * tp_ratio, 3)
            for rsi_min in [35, 40, 45, 50]:
                for rsi_max in [60, 65, 70, 75]:
                    if rsi_min >= rsi_max:
                        continue
                    for lookback in [1, 2, 3]:
                        for ema_pair in [(9, 21), (8, 21), (9, 26)]:
                            configs.append({
                                "ema_fast": ema_pair[0],
                                "ema_slow": ema_pair[1],
                                "rsi_min": rsi_min, "rsi_max": rsi_max,
                                "lookback": lookback,
                                "sl": sl, "tp": tp,
                                "label": f"SL={sl:.1%} TP={tp:.1%} RSI={rsi_min}-{rsi_max} LB={lookback} EMA{ema_pair[0]}/{ema_pair[1]}",
                            })

    print(f"\nTesting {len(configs)} configs...")

    results = []
    for cfg in configs:
        combined_pnl = 0
        combined_trades = 0
        combined_wins = 0
        worst_dd = 0
        token_results = {}
        for sym, d in token_data.items():
            r = backtest(d, cfg)
            token_results[sym] = r
            combined_pnl    += r["pnl"]
            combined_trades += r["trades"]
            combined_wins   += r["wins"]
            worst_dd = max(worst_dd, r["max_dd"])
        results.append({
            "cfg": cfg, "tokens": token_results,
            "combined_pnl": combined_pnl,
            "combined_trades": combined_trades,
            "combined_wr": combined_wins / combined_trades * 100 if combined_trades else 0,
            "worst_dd": worst_dd,
        })

    elapsed = time.time() - t0
    results.sort(key=lambda x: x["combined_pnl"], reverse=True)

    print(f"\nDone in {elapsed:.1f}s")
    print("\n" + "=" * 85)
    print("TOP 15 CONFIGS (combined PnL across SOL+BONK+WIF)")
    print("=" * 85)
    print(f"{'#':>3}  {'PnL':>8}  {'WR%':>6}  {'#Trd':>5}  {'MaxDD':>6}  Config")
    print("-" * 85)
    for i, r in enumerate(results[:15]):
        print(f"{i+1:>3}  ${r['combined_pnl']:>+7.2f}  {r['combined_wr']:>5.1f}%  "
              f"{r['combined_trades']:>5}  {r['worst_dd']:>5.1f}%  {r['cfg']['label']}")

    # Per-token breakdown for top 5
    for i, r in enumerate(results[:5]):
        print(f"\n--- #{i+1}: {r['cfg']['label']} ---")
        for sym in ["SOL", "BONK", "WIF"]:
            t = r["tokens"][sym]
            print(f"  {sym:>6}: {t['trades']:>3}T  WR={t['win_rate']:>5.1f}%  "
                  f"PnL=${t['pnl']:>+7.2f}  Final=${t['final']:>7.2f}  MaxDD={t['max_dd']:.1f}%")

    # SOL-only top 10
    sol_sorted = sorted(results, key=lambda x: x["tokens"]["SOL"]["pnl"], reverse=True)
    print("\n" + "=" * 85)
    print("SOL-ONLY TOP 10")
    print("=" * 85)
    print(f"{'#':>3}  {'PnL':>8}  {'WR%':>6}  {'#Trd':>5}  {'MaxDD':>6}  Config")
    print("-" * 85)
    for i, r in enumerate(sol_sorted[:10]):
        s = r["tokens"]["SOL"]
        print(f"{i+1:>3}  ${s['pnl']:>+7.2f}  {s['win_rate']:>5.1f}%  "
              f"{s['trades']:>5}  {s['max_dd']:>5.1f}%  {r['cfg']['label']}")

    # Profitable-only leaderboard
    profitable = [r for r in results if all(r["tokens"][s]["pnl"] > 0 for s in ["SOL","BONK","WIF"])]
    if profitable:
        print(f"\n{'=' * 85}")
        print(f"CONFIGS PROFITABLE ON ALL 3 TOKENS ({len(profitable)} found)")
        print("=" * 85)
        for i, r in enumerate(profitable[:10]):
            print(f"{i+1:>3}  ${r['combined_pnl']:>+7.2f}  {r['combined_wr']:>5.1f}%  "
                  f"{r['combined_trades']:>5}T  MaxDD={r['worst_dd']:.1f}%  {r['cfg']['label']}")
    else:
        print("\nNo config was profitable on ALL 3 tokens simultaneously.")
        # Show configs profitable on at least 2
        two_plus = [r for r in results if sum(1 for s in ["SOL","BONK","WIF"] if r["tokens"][s]["pnl"] > 0) >= 2]
        if two_plus:
            two_plus.sort(key=lambda x: x["combined_pnl"], reverse=True)
            print(f"Configs profitable on 2+ tokens: {len(two_plus)}")
            for i, r in enumerate(two_plus[:10]):
                tags = " ".join(f"{s}:${r['tokens'][s]['pnl']:+.0f}" for s in ["SOL","BONK","WIF"])
                print(f"  {i+1:>3}  ${r['combined_pnl']:>+7.2f}  {tags}  {r['cfg']['label']}")

    print()


if __name__ == "__main__":
    main()
