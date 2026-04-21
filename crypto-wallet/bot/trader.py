import requests
import logging
import time
import base64
from solders.transaction import VersionedTransaction
from solana.rpc.api import Client
from solana.rpc.types import TxOpts
from solana.rpc.commitment import Confirmed
from solders.keypair import Keypair
from wallet import get_keypair, get_rpc_url
from config import SLIPPAGE_BPS, MAX_PRICE_IMPACT_PCT, PRIORITY_FEE_LAMPORTS, TX_CONFIRM_TIMEOUT_SEC, POLL_INTERVAL_SEC

log = logging.getLogger(__name__)

JUPITER_QUOTE_URL = "https://lite-api.jup.ag/swap/v1/quote"
JUPITER_SWAP_URL  = "https://lite-api.jup.ag/swap/v1/swap"


TOKEN_PROGRAM    = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
TOKEN_2022       = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"


def get_sol_balance_lamports(wallet_address: str) -> int:
    """Get SOL balance in lamports."""
    client = Client(get_rpc_url())
    from solders.pubkey import Pubkey
    resp = client.get_balance(Pubkey.from_string(wallet_address))
    return resp.value


def get_token_balance_lamports(wallet_address: str, mint: str) -> int:
    """
    Get token balance in raw units (lamports equivalent).
    Checks both SPL Token and Token-2022 programs.
    """
    import requests as req
    rpc = get_rpc_url()
    for program in [TOKEN_PROGRAM, TOKEN_2022]:
        payload = {
            "jsonrpc": "2.0", "id": 1,
            "method": "getTokenAccountsByOwner",
            "params": [
                wallet_address,
                {"programId": program},
                {"encoding": "jsonParsed"}
            ]
        }
        resp = req.post(rpc, json=payload, timeout=10).json()
        for acc in resp.get("result", {}).get("value", []):
            info = acc["account"]["data"]["parsed"]["info"]
            if info["mint"] == mint:
                return int(info["tokenAmount"]["amount"])
    return 0


def get_quote(input_mint: str, output_mint: str, amount_lamports: int) -> dict | None:
    """Get best swap route from Jupiter."""
    params = {
        "inputMint": input_mint,
        "outputMint": output_mint,
        "amount": str(amount_lamports),
        "slippageBps": str(SLIPPAGE_BPS),
        "onlyDirectRoutes": "false",
        "asLegacyTransaction": "false",
    }
    try:
        resp = requests.get(JUPITER_QUOTE_URL, params=params, timeout=10)
        resp.raise_for_status()
        quote = resp.json()
        if "error" in quote:
            log.error(f"Jupiter quote error: {quote['error']}")
            return None
        return quote
    except Exception as e:
        log.error(f"Quote request failed: {e}")
        return None


def check_price_impact(quote: dict) -> bool:
    """Reject if price impact exceeds threshold."""
    impact = float(quote.get("priceImpactPct", 0))
    if impact > MAX_PRICE_IMPACT_PCT:
        log.warning(f"Price impact too high: {impact:.2f}% > {MAX_PRICE_IMPACT_PCT}%")
        return False
    return True


def execute_swap(quote: dict) -> str | None:
    """
    Build, sign, and send the swap transaction via Jupiter.
    Returns transaction signature on success, None on failure.
    """
    keypair = get_keypair()
    rpc_url = get_rpc_url()
    client = Client(rpc_url)

    payload = {
        "quoteResponse": quote,
        "userPublicKey": str(keypair.pubkey()),
        "wrapAndUnwrapSol": True,
        "prioritizationFeeLamports": PRIORITY_FEE_LAMPORTS,
        "dynamicComputeUnitLimit": True,
    }

    try:
        resp = requests.post(JUPITER_SWAP_URL, json=payload, timeout=15)
        resp.raise_for_status()
        swap_data = resp.json()
    except Exception as e:
        log.error(f"Swap API request failed: {e}")
        return None

    swap_tx_b64 = swap_data.get("swapTransaction")
    if not swap_tx_b64:
        log.error("No swapTransaction in Jupiter response")
        return None

    try:
        raw_tx = base64.b64decode(swap_tx_b64)
        tx = VersionedTransaction.from_bytes(raw_tx)
        # solders 0.27: VersionedTransaction(message, signers) signs internally
        tx_signed = VersionedTransaction(tx.message, [keypair])
        raw_signed = bytes(tx_signed)
    except Exception as e:
        log.error(f"Transaction signing failed: {e}")
        return None

    try:
        result = client.send_raw_transaction(
            raw_signed,
            opts=TxOpts(skip_preflight=False, preflight_commitment=Confirmed)
        )
        sig = str(result.value)
        log.info(f"Transaction sent: {sig}")
        return sig
    except Exception as e:
        log.error(f"Transaction send failed: {e}")
        return None


def confirm_transaction(sig: str) -> bool:
    """Poll until transaction confirmed using getTransaction (more reliable than getSignatureStatuses)."""
    import requests as req
    rpc = get_rpc_url()
    deadline = time.time() + TX_CONFIRM_TIMEOUT_SEC
    while time.time() < deadline:
        try:
            payload = {
                "jsonrpc": "2.0", "id": 1,
                "method": "getTransaction",
                "params": [sig, {"encoding": "json", "maxSupportedTransactionVersion": 0}]
            }
            resp = req.post(rpc, json=payload, timeout=10).json()
            result = resp.get("result")
            if result is not None:
                err = result.get("meta", {}).get("err")
                if err:
                    log.error(f"Transaction failed on-chain: {err}")
                    return False
                log.info(f"Transaction confirmed: {sig}")
                return True
        except Exception as e:
            log.warning(f"Confirmation poll error: {e}")
        time.sleep(POLL_INTERVAL_SEC)
    log.error(f"Transaction confirmation timeout: {sig}")
    return False


def buy(input_mint: str, output_mint: str, amount_lamports: int) -> tuple[bool, dict | None]:
    """
    Execute a buy swap. Returns (success, quote).
    """
    log.info(f"Getting quote: {amount_lamports} lamports {input_mint} → {output_mint}")
    quote = get_quote(input_mint, output_mint, amount_lamports)
    if not quote:
        return False, None
    if not check_price_impact(quote):
        return False, None
    sig = execute_swap(quote)
    if not sig:
        return False, quote
    confirmed = confirm_transaction(sig)
    return confirmed, quote


def sell(input_mint: str, output_mint: str, amount_lamports: int) -> tuple[bool, dict | None]:
    """
    Execute a sell swap. Returns (success, quote).
    """
    log.info(f"Getting quote: {amount_lamports} lamports {input_mint} → {output_mint}")
    quote = get_quote(input_mint, output_mint, amount_lamports)
    if not quote:
        return False, None
    if not check_price_impact(quote):
        return False, None
    sig = execute_swap(quote)
    if not sig:
        return False, quote
    confirmed = confirm_transaction(sig)
    return confirmed, quote
