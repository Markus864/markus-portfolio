import logging
import time
from config import TOKEN_WHITELIST
from signals import check_signal

log = logging.getLogger(__name__)

API_DELAY = 2  # seconds between Birdeye calls to avoid 429 rate limits


def scan() -> tuple[str, str] | None:
    """
    Scan whitelisted tokens for RSI mean reversion entry signal.
    Returns (symbol, mint) of first confirmed setup, or None.
    """
    log.info(f"Scanning {list(TOKEN_WHITELIST.keys())} for setups...")
    for i, (symbol, mint) in enumerate(TOKEN_WHITELIST.items()):
        if i > 0:
            time.sleep(API_DELAY)
        if check_signal(mint, symbol):
            log.info(f"Setup confirmed: {symbol} ({mint})")
            return symbol, mint
    log.info("No setup found this scan cycle.")
    return None
