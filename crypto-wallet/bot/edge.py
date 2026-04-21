"""
Red Tip Trading Bot — Edge Modules
Kelly sizing, EV gate, buy/sell pressure, X sentiment, new listing sniper.
"""

import logging
import time
import requests
from config import BIRDEYE_API_KEY, BIRDEYE_BASE_URL, _vault

log = logging.getLogger(__name__)

BIRDEYE_HEADERS = {"X-API-KEY": BIRDEYE_API_KEY, "x-chain": "solana"}

# X/Twitter bearer token — loaded from vault
X_BEARER = _vault.get("x", {}).get("bearer_token", "")


# ─── KELLY CRITERION ───────────────────────────────────────────────────────────
# Backtest: 44.9% win rate, 6% TP, 3% SL
# Kelly: f* = (W * b - L) / b  where b = win/loss ratio, W = win prob, L = loss prob
# Half-Kelly is standard for live trading (less volatile)

def kelly_fraction(win_rate: float = 0.449, win_pct: float = 0.06,
                   loss_pct: float = 0.03) -> float:
    """
    Calculate half-Kelly position size fraction.
    Returns fraction of capital to risk (0.0 to 1.0).
    """
    if win_rate <= 0 or loss_pct <= 0:
        return 0.0
    b = win_pct / loss_pct  # payoff ratio (2.0 for 6%/3%)
    f_full = (win_rate * b - (1 - win_rate)) / b
    f_half = f_full / 2
    # Clamp between 5% and 90%
    return max(0.05, min(0.90, f_half))


def kelly_position_size(capital: float, win_rate: float = 0.449) -> float:
    """Returns USDC amount to risk based on half-Kelly."""
    frac = kelly_fraction(win_rate)
    return capital * frac


# ─── EXPECTED VALUE GATE ───────────────────────────────────────────────────────

def ev_per_trade(win_rate: float = 0.449, win_pct: float = 0.06,
                 loss_pct: float = 0.03) -> float:
    """Expected value per $1 risked."""
    return win_rate * win_pct - (1 - win_rate) * loss_pct
    # 0.449 * 0.06 - 0.551 * 0.03 = 0.02694 - 0.01653 = 0.01041 (+1.04% per trade)


def ev_gate_pass(win_rate: float = 0.449, min_ev: float = 0.005) -> bool:
    """Only allow trades where EV exceeds minimum threshold."""
    ev = ev_per_trade(win_rate)
    log.info(f"EV gate: EV={ev:.4f} min={min_ev:.4f} pass={ev > min_ev}")
    return ev > min_ev


# ─── BUY/SELL PRESSURE (Birdeye Trade Data) ───────────────────────────────────

def get_trade_pressure(mint: str) -> dict | None:
    """
    Get buy vs sell pressure from Birdeye trade data.
    Returns dict with buy_ratio, volume_trend, unique_wallets, etc.
    """
    try:
        resp = requests.get(
            f"{BIRDEYE_BASE_URL}/defi/v3/token/trade-data/single",
            headers=BIRDEYE_HEADERS,
            params={"address": mint},
            timeout=10,
        )
        if not resp.ok:
            log.warning(f"Trade data error {resp.status_code}: {resp.text[:100]}")
            return None
        data = resp.json().get("data", {})
        if not data:
            return None

        # 5-minute buy/sell data
        buy_5m = data.get("buy_5m", 0)
        sell_5m = data.get("sell_5m", 0)
        total_5m = buy_5m + sell_5m
        buy_ratio_5m = buy_5m / total_5m if total_5m > 0 else 0.5

        # Volume trend (current vs previous period)
        vol_now = data.get("volume_5m_usd", 0)
        vol_prev = data.get("volume_history_5m_usd", 0)
        vol_change = (vol_now - vol_prev) / vol_prev * 100 if vol_prev > 0 else 0

        # Buy volume vs sell volume
        vol_buy = data.get("volume_buy_5m_usd", 0)
        vol_sell = data.get("volume_sell_5m_usd", 0)
        vol_total = vol_buy + vol_sell
        buy_vol_ratio = vol_buy / vol_total if vol_total > 0 else 0.5

        # Unique wallets trend
        wallets_now = data.get("unique_wallet_5m", 0)
        wallets_prev = data.get("unique_wallet_history_5m", 0)
        wallet_change = (wallets_now - wallets_prev) / wallets_prev * 100 if wallets_prev > 0 else 0

        result = {
            "buy_ratio_5m": buy_ratio_5m,
            "buy_vol_ratio": buy_vol_ratio,
            "vol_change_pct": vol_change,
            "wallet_change_pct": wallet_change,
            "buy_5m": buy_5m,
            "sell_5m": sell_5m,
            "vol_buy_usd": vol_buy,
            "vol_sell_usd": vol_sell,
        }
        log.info(
            f"Pressure: buy_ratio={buy_ratio_5m:.2f} buy_vol={buy_vol_ratio:.2f} "
            f"vol_chg={vol_change:+.1f}% wallet_chg={wallet_change:+.1f}%"
        )
        return result
    except Exception as e:
        log.warning(f"Trade pressure error: {e}")
        return None


def pressure_bullish(mint: str) -> bool:
    """
    Returns True if buy pressure confirms bullish conditions.
    Criteria: more buy volume than sell volume in last 5 minutes.
    """
    data = get_trade_pressure(mint)
    if data is None:
        return True  # Fail open — don't block trades on API error
    return data["buy_vol_ratio"] > 0.50


# ─── X/TWITTER SENTIMENT ──────────────────────────────────────────────────────

NEGATIVE_KEYWORDS = [
    "crash", "dump", "rug", "scam", "hack", "exploit", "bankrupt",
    "sec ", "lawsuit", "bear", "sell", "short", "rekt", "ponzi",
    "dead", "avoid", "warning", "fraud", "insolvent",
]
POSITIVE_KEYWORDS = [
    "bullish", "moon", "pump", "buy", "long", "breakout", "ath",
    "rally", "accumulate", "upgrade", "partnership", "launch",
    "adoption", "institutional", "profit", "gain",
]


def get_x_sentiment(symbol: str, max_tweets: int = 20) -> dict | None:
    """
    Search recent tweets for $SYMBOL cashtag, score sentiment.
    Returns {score: -1 to +1, positive: N, negative: N, neutral: N, total: N}
    """
    try:
        query = f"${symbol} lang:en -is:retweet"
        resp = requests.get(
            "https://api.twitter.com/2/tweets/search/recent",
            headers={"Authorization": f"Bearer {X_BEARER}"},
            params={
                "query": query,
                "max_results": min(max_tweets, 100),
                "tweet.fields": "public_metrics",
            },
            timeout=10,
        )
        if not resp.ok:
            log.warning(f"X API error {resp.status_code}: {resp.text[:100]}")
            return None

        tweets = resp.json().get("data", [])
        if not tweets:
            return {"score": 0, "positive": 0, "negative": 0, "neutral": 0, "total": 0}

        pos = 0
        neg = 0
        neutral = 0
        for t in tweets:
            text = t.get("text", "").lower()
            metrics = t.get("public_metrics", {})
            # Weight by engagement (likes + retweets)
            weight = 1 + metrics.get("like_count", 0) + metrics.get("retweet_count", 0) * 2

            pos_hits = sum(1 for kw in POSITIVE_KEYWORDS if kw in text)
            neg_hits = sum(1 for kw in NEGATIVE_KEYWORDS if kw in text)

            if pos_hits > neg_hits:
                pos += weight
            elif neg_hits > pos_hits:
                neg += weight
            else:
                neutral += weight

        total = pos + neg + neutral
        score = (pos - neg) / total if total > 0 else 0

        result = {
            "score": score,  # -1 (bearish) to +1 (bullish)
            "positive": pos,
            "negative": neg,
            "neutral": neutral,
            "total": len(tweets),
        }
        log.info(
            f"X Sentiment [{symbol}]: score={score:+.2f} "
            f"pos={pos} neg={neg} neutral={neutral} tweets={len(tweets)}"
        )
        return result
    except Exception as e:
        log.warning(f"X sentiment error: {e}")
        return None


def sentiment_not_bearish(symbol: str) -> bool:
    """
    Returns True if X sentiment is not actively bearish.
    Blocks trade if sentiment score < -0.3 (strong negative).
    """
    data = get_x_sentiment(symbol)
    if data is None:
        return True  # Fail open
    return data["score"] > -0.3


# ─── NEW LISTING SNIPER ───────────────────────────────────────────────────────

MIN_LIQUIDITY_USD = 50_000  # Minimum $50k liquidity to consider


def get_new_listings(limit: int = 20) -> list[dict]:
    """
    Fetch new token listings from Birdeye.
    Returns list of {address, symbol, name, liquidity, source, listed_at}
    """
    try:
        resp = requests.get(
            f"{BIRDEYE_BASE_URL}/defi/v2/tokens/new_listing",
            headers=BIRDEYE_HEADERS,
            params={"limit": limit, "time_to": int(time.time())},
            timeout=10,
        )
        if not resp.ok:
            log.warning(f"New listings error {resp.status_code}")
            return []

        items = resp.json().get("data", {}).get("items", [])
        return [
            {
                "address": i.get("address"),
                "symbol": i.get("symbol", "?"),
                "name": i.get("name", "?"),
                "liquidity": i.get("liquidity", 0),
                "source": i.get("source", "?"),
                "listed_at": i.get("liquidityAddedAt", "?"),
            }
            for i in items
        ]
    except Exception as e:
        log.warning(f"New listings error: {e}")
        return []


def get_token_security(mint: str) -> dict | None:
    """Check token security (freeze authority, mint authority, etc.)"""
    try:
        resp = requests.get(
            f"{BIRDEYE_BASE_URL}/defi/token_security",
            headers=BIRDEYE_HEADERS,
            params={"address": mint},
            timeout=10,
        )
        if not resp.ok:
            return None
        return resp.json().get("data", {})
    except Exception:
        return None


def filter_safe_listings() -> list[dict]:
    """
    Get new listings filtered for safety:
    - Minimum liquidity
    - No freeze authority
    - Mint authority revoked (or null)
    """
    listings = get_new_listings(50)
    safe = []
    for token in listings:
        if token["liquidity"] < MIN_LIQUIDITY_USD:
            continue

        # Rate limit protection
        time.sleep(1)
        security = get_token_security(token["address"])
        if security is None:
            continue

        # Safety checks
        freeze = security.get("freezeAuthority")
        mint_auth = security.get("mintAuthority")
        is_token_2022 = security.get("isToken2022", False)

        if freeze and freeze != "null":
            log.info(f"Skip {token['symbol']}: has freeze authority")
            continue
        if mint_auth and mint_auth != "null":
            log.info(f"Skip {token['symbol']}: has mint authority (can mint more)")
            continue

        token["security"] = security
        safe.append(token)
        log.info(
            f"Safe listing: {token['symbol']} | ${token['liquidity']:.0f} liq | "
            f"{token['source']}"
        )

    return safe


# ─── COMBINED EDGE CHECK ──────────────────────────────────────────────────────

def full_edge_check(mint: str, symbol: str, win_rate: float = 0.449) -> dict:
    """
    Run all edge checks. Returns dict with results and overall pass/fail.
    The bot should only enter if edge['pass'] is True.
    """
    results = {
        "ev_pass": False,
        "pressure_pass": False,
        "sentiment_pass": False,
        "ev": 0,
        "kelly_frac": 0,
        "pass": False,
    }

    # 1. EV Gate
    ev = ev_per_trade(win_rate)
    results["ev"] = ev
    results["ev_pass"] = ev > 0.005
    if not results["ev_pass"]:
        log.info(f"Edge BLOCKED: EV too low ({ev:.4f})")
        return results

    # 2. Kelly sizing
    results["kelly_frac"] = kelly_fraction(win_rate)

    # 3. Buy/sell pressure
    results["pressure_pass"] = pressure_bullish(mint)
    time.sleep(2)  # Rate limit

    # 4. X sentiment
    results["sentiment_pass"] = sentiment_not_bearish(symbol)

    # Overall: EV must pass. Pressure and sentiment are soft filters —
    # block only if BOTH are negative.
    if results["pressure_pass"] or results["sentiment_pass"]:
        results["pass"] = True
    else:
        log.info(f"Edge BLOCKED: both pressure and sentiment negative for {symbol}")

    log.info(
        f"Edge [{symbol}]: EV={ev:.4f} kelly={results['kelly_frac']:.2f} "
        f"pressure={results['pressure_pass']} sentiment={results['sentiment_pass']} "
        f"PASS={results['pass']}"
    )
    return results
