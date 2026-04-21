import json
import os
from pathlib import Path
from solders.keypair import Keypair
from solders.pubkey import Pubkey
import base58

VAULT_PATH = Path(os.environ.get("VAULT_PATH", str(
    Path.home() / ".openclaw" / "credentials" / "openclaw_vault.json"
)))

def load_vault() -> dict:
    with open(VAULT_PATH) as f:
        return json.load(f)

def get_keypair() -> Keypair:
    vault = load_vault()
    private_key_b58 = vault["solana"]["private_key"]
    raw = base58.b58decode(private_key_b58)
    return Keypair.from_bytes(raw)

def get_rpc_url() -> str:
    vault = load_vault()
    return vault["solana"]["rpc_url"]

def get_wallet_address() -> str:
    vault = load_vault()
    return vault["solana"]["wallet_address"]
