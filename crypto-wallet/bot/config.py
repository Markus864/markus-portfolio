import json, os
from pathlib import Path

# ─── Vault ────────────────────────────────────────────────────────────────────
# All secrets loaded from vault — NEVER hardcode keys in source files
_VAULT_PATH = Path(os.environ.get("VAULT_PATH", str(
    Path.home() / ".openclaw" / "credentials" / "openclaw_vault.json"
)))

def _load_vault():
    with open(_VAULT_PATH) as f:
        return json.load(f)

_vault = _load_vault()

# ─── Solana / Jupiter ─────────────────────────────────────────────────────────
SOL_MINT  = "So11111111111111111111111111111111111111112"
USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

SLIPPAGE_BPS            = 200       # 2% — established tokens have tighter spreads
MAX_PRICE_IMPACT_PCT    = 1.0       # Reject trades with >1% price impact
TX_CONFIRM_TIMEOUT_SEC  = 120
POLL_INTERVAL_SEC       = 5
PRIORITY_FEE_LAMPORTS   = 10000

# ─── Token Whitelist ──────────────────────────────────────────────────────────
# No memecoins. Established Solana ecosystem tokens only.
# 10 tokens — backtested 30d: RSI35 + 10 tokens = +$40/month, 57% WR, 0.7 trades/day
TOKEN_WHITELIST = {
    "SOL":    "So11111111111111111111111111111111111111112",
    "JUP":    "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    "JTO":    "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL",
    "RAY":    "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
    "ORCA":   "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE",
    "PYTH":   "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3",
    "W":      "85VBFQZC9TZkfaptBWjvUw7YbZjy52A6mjtPGjstQAmQ",
    "RENDER": "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof",
    "HNT":    "hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux",
    "DRIFT":  "DriFtupJYLTosbwoN8koMbEYSx54aFAVLddWsbksjwg7",
}

# ─── Birdeye ──────────────────────────────────────────────────────────────────
BIRDEYE_API_KEY  = _vault.get("solana", {}).get("birdeye_api_key", "")
BIRDEYE_BASE_URL = "https://public-api.birdeye.so"

# ─── Telegram ─────────────────────────────────────────────────────────────────
TELEGRAM_BOT_TOKEN = _vault.get("solana", {}).get("telegram_bot_token", "")
TELEGRAM_CHAT_ID   = _vault.get("solana", {}).get("telegram_chat_id", "")

# ─── Signal Parameters ────────────────────────────────────────────────────────
# Strategy: RSI Mean Reversion — buy when RSI bounces from <35 in a macro uptrend
# Backtested on 15m candles (30 days, 10 tokens): +$40, 57% WR, 0.7 trades/day
CANDLE_INTERVAL    = "15m"
CANDLES_NEEDED     = 220       # EMA 200 warmup
EMA_TREND_FAST     = 50        # Macro trend gate: 50 EMA must be above 200 EMA
EMA_TREND_SLOW     = 200
RSI_PERIOD         = 14
RSI_OVERSOLD       = 35        # Buy when RSI crosses back above this level

# ─── Risk Management ──────────────────────────────────────────────────────────
POSITION_SIZE_PCT     = 0.90   # 90% of capital per trade
STOP_LOSS_PCT         = 0.03   # 3% hard stop loss
TAKE_PROFIT_PCT       = 0.06   # 6% take profit — 1:2 R/R
KILL_SWITCH_FLOOR_USD = 50.0   # Halt if capital drops below $50

# ─── Timing ───────────────────────────────────────────────────────────────────
SCAN_INTERVAL_SEC  = 60        # Scan every 60 seconds
POSITION_POLL_SEC  = 30        # Check position price every 30 seconds
