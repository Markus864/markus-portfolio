import logging
from birdeye import get_ohlcv, get_price
from config import (
    EMA_TREND_FAST, EMA_TREND_SLOW,
    RSI_PERIOD, RSI_OVERSOLD,
    CANDLE_INTERVAL, CANDLES_NEEDED,
)

log = logging.getLogger(__name__)


def _ema(prices: list[float], period: int) -> list[float]:
    """Exponential Moving Average."""
    k = 2 / (period + 1)
    result = [prices[0]]
    for p in prices[1:]:
        result.append(p * k + result[-1] * (1 - k))
    return result


def _rsi_array(prices: list[float], period: int = 14) -> list[float]:
    """RSI for every index. Returns array same length as prices."""
    n = len(prices)
    out = [50.0] * n
    if n < period + 1:
        return out
    deltas = [prices[i] - prices[i - 1] for i in range(1, n)]
    ag = sum(max(d, 0) for d in deltas[:period]) / period
    al = sum(max(-d, 0) for d in deltas[:period]) / period
    out[period] = 100.0 if al == 0 else 100 - (100 / (1 + ag / al))
    for i in range(period, len(deltas)):
        ag = (ag * (period - 1) + max(deltas[i], 0)) / period
        al = (al * (period - 1) + max(-deltas[i], 0)) / period
        out[i + 1] = 100.0 if al == 0 else 100 - (100 / (1 + ag / al))
    return out


def check_signal(mint: str, symbol: str) -> bool:
    """
    RSI Mean Reversion Strategy:
      1. Macro trend gate: EMA50 > EMA200 (confirmed uptrend)
      2. RSI was below RSI_OVERSOLD (30) on previous candle
      3. RSI crossed back above RSI_OVERSOLD on current candle
    This buys oversold bounces in bull markets.
    """
    candles = get_ohlcv(mint, CANDLE_INTERVAL, CANDLES_NEEDED)
    if not candles or len(candles) < EMA_TREND_SLOW + 5:
        log.info(f"{symbol}: insufficient candles ({len(candles) if candles else 0})")
        return False

    closes  = [c["c"] for c in candles]
    ema_50  = _ema(closes, EMA_TREND_FAST)
    ema_200 = _ema(closes, EMA_TREND_SLOW)
    rsi     = _rsi_array(closes, RSI_PERIOD)

    # Macro trend gate
    macro_bull = ema_50[-1] > ema_200[-1]

    # RSI bounce: was oversold, now crossing back up
    rsi_prev    = rsi[-2]
    rsi_current = rsi[-1]
    rsi_bounce  = rsi_prev < RSI_OVERSOLD and rsi_current >= RSI_OVERSOLD

    log.info(
        f"{symbol}: EMA50={ema_50[-1]:.5f} EMA200={ema_200[-1]:.5f} "
        f"RSI_prev={rsi_prev:.1f} RSI_now={rsi_current:.1f} "
        f"macro_bull={macro_bull} rsi_bounce={rsi_bounce}"
    )

    return macro_bull and rsi_bounce


def get_token_price(mint: str) -> float | None:
    """Get current USD price from Birdeye."""
    return get_price(mint)
