# Red Tip Trading Bot v2

Automated Solana/Jupiter trading bot using RSI mean reversion strategy.

## Strategy
- **RSI Mean Reversion**: Buy when RSI bounces from <30 in a macro uptrend (EMA50 > EMA200)
- **Timeframe**: 15-minute candles
- **Tokens**: SOL, JUP, JTO, RAY (established Solana ecosystem only)
- **Risk**: 3% stop loss / 6% take profit (1:2 R/R)

## Edge Modules
- **Kelly Criterion**: Half-Kelly position sizing based on backtested win rate
- **EV Gate**: Only trades when expected value exceeds 0.5% per trade
- **Buy/Sell Pressure**: Birdeye trade data confirmation
- **X/Twitter Sentiment**: Engagement-weighted keyword scoring

## Infrastructure
- Runs 24/7 on Linux server via systemd
- Telegram slash commands for remote control
- Web dashboard on port 7777
- SQLite trade log for durable record keeping
- Daily P&L summary via Telegram cron

## Setup
1. Set `VAULT_PATH` env var pointing to your credentials vault JSON, or place it at `~/.openclaw/credentials/openclaw_vault.json`
2. Vault must contain: `solana.wallet_address`, `solana.private_key`, `solana.rpc_url`, `solana.birdeye_api_key`, `solana.telegram_bot_token`, `solana.telegram_chat_id`
3. `pip install -r requirements.txt`
4. `python bot/main.py`

## Backtesting
- `backtest.py` - 1H 6-month backtest
- `backtest_15m.py` - 15m 50-day backtest (primary validation)
- `backtest_optimize.py` - Parameter grid sweep
- `backtest_strategies.py` - Multi-strategy comparison
