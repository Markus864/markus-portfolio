import requests
import time
import logging
from config import BIRDEYE_API_KEY, BIRDEYE_BASE_URL

log = logging.getLogger(__name__)

_HEADERS = {
    "X-API-KEY": BIRDEYE_API_KEY,
    "x-chain": "solana",
}

_INTERVAL_SECONDS = {
    "1m": 60, "5m": 300, "15m": 900,
    "30m": 1800, "1H": 3600, "4H": 14400, "1D": 86400,
}


def get_ohlcv(mint: str, interval: str = "15m", count: int = 60) -> list[dict] | None:
    """Fetch OHLCV candles from Birdeye v3 API. Returns list of candle dicts or None."""
    secs = _INTERVAL_SECONDS.get(interval, 900)
    time_to = int(time.time())
    time_from = time_to - (count * secs)
    try:
        resp = requests.get(
            f"{BIRDEYE_BASE_URL}/defi/v3/ohlcv",
            headers=_HEADERS,
            params={
                "address": mint,
                "type": interval,
                "time_from": time_from,
                "time_to": time_to,
                "currency": "usd",
            },
            timeout=10,
        )
        resp.raise_for_status()
        items = resp.json().get("data", {}).get("items", [])
        return items if items else None
    except Exception as e:
        log.error(f"Birdeye OHLCV error for {mint}: {e}")
        return None


def get_price(mint: str) -> float | None:
    """Get current USD price from Birdeye."""
    try:
        resp = requests.get(
            f"{BIRDEYE_BASE_URL}/defi/price",
            headers=_HEADERS,
            params={"address": mint, "check_liquidity": 20},
            timeout=8,
        )
        resp.raise_for_status()
        price = resp.json().get("data", {}).get("value")
        return float(price) if price else None
    except Exception as e:
        log.error(f"Birdeye price error for {mint}: {e}")
        return None
