#!/usr/bin/env bash
# Deploy VerifierRegistry + Vault on a Tempo chain with explicit gas limits.
#
# Why not `forge script --broadcast`? Tempo charges 1,000 gas per byte of deployed code (5x Ethereum) plus
# 250,000 per new account (TIP-1000), and the node's eth_estimateGas does not include it, so a scripted
# CREATE runs out of gas exactly at its estimate. The per-transaction cap is 30,000,000. Vault (~21 KB)
# deploys in ~24M gas; the registry in ~3M.
#
# Env (see contracts/.env.moderato, gitignored):
#   DEPLOYER_PRIVATE_KEY  DEPLOYER_ADDRESS  ARBITER_ADDRESS  INTAKE_ADDRESS  VERIFIER_ADDRESS
#   FEE_RECIPIENT (default deployer)  FEE_BPS (default 100)  VERIFIER_URI  RPC_URL (default Moderato)
#   TOKENS (default pathUSD + USDC.e)
#   REGISTRY      reuse an already deployed VerifierRegistry instead of deploying a new one
#   EARN_VAULTS   comma list of Earn vaults to allow-list (F11)
#   ZONE_PORTALS  comma list of `portal:legacy` entries to allow-list (F12), e.g. 0x7069...:true
set -euo pipefail
cd "$(dirname "$0")/.."

RPC_URL="${RPC_URL:-https://rpc.moderato.tempo.xyz}"
FEE_RECIPIENT="${FEE_RECIPIENT:-$DEPLOYER_ADDRESS}"
FEE_BPS="${FEE_BPS:-100}"
VERIFIER_URI="${VERIFIER_URI:-https://vouch.dev/verifier}"
TOKENS="${TOKENS:-[0x20C0000000000000000000000000000000000000,0x20C000000000000000000000b9537d11c60E8b50]}"
CHAIN_ID=$(cast chain-id --rpc-url "$RPC_URL")

json_field() { python3 -c 'import sys,json,re;m=re.search(r"\{.*\}",sys.stdin.read(),re.S);print(json.loads(m.group(0))[sys.argv[1]])' "$1"; }
send() { cast send "$@" --private-key "$DEPLOYER_PRIVATE_KEY" --rpc-url "$RPC_URL" --json | json_field status; }

echo "chain $CHAIN_ID · deployer $DEPLOYER_ADDRESS"
forge build >/dev/null

if [ -n "${REGISTRY:-}" ]; then
  REG_TX="reused"
  echo "VerifierRegistry $REGISTRY (reused)"
else
  REG_OUT=$(forge create src/VerifierRegistry.sol:VerifierRegistry --private-key "$DEPLOYER_PRIVATE_KEY" --rpc-url "$RPC_URL" --broadcast --gas-limit 5000000 --json --constructor-args "$DEPLOYER_ADDRESS")
  REGISTRY=$(echo "$REG_OUT" | json_field deployedTo); REG_TX=$(echo "$REG_OUT" | json_field transactionHash)
  echo "VerifierRegistry $REGISTRY ($REG_TX)"
fi

VAULT_OUT=$(forge create src/Vault.sol:Vault --private-key "$DEPLOYER_PRIVATE_KEY" --rpc-url "$RPC_URL" --broadcast --gas-limit 30000000 --json --constructor-args "$DEPLOYER_ADDRESS" "$REGISTRY" "$ARBITER_ADDRESS" "$INTAKE_ADDRESS" "$TOKENS")
VAULT=$(echo "$VAULT_OUT" | json_field deployedTo); VAULT_TX=$(echo "$VAULT_OUT" | json_field transactionHash)
echo "Vault            $VAULT ($VAULT_TX)"

[ "$REG_TX" = "reused" ] || echo "setVerifier: $(send "$REGISTRY" 'setVerifier(address,bool,string)' "$VERIFIER_ADDRESS" true "$VERIFIER_URI" --gas-limit 800000)"
echo "setFee:      $(send "$VAULT" 'setFee(uint16,address)' "$FEE_BPS" "$FEE_RECIPIENT" --gas-limit 400000)"
for ev in ${EARN_VAULTS:+${EARN_VAULTS//,/ }}; do
  echo "setEarnVault $ev: $(send "$VAULT" 'setEarnVault(address,bool)' "$ev" true --gas-limit 400000)"
done
for zp in ${ZONE_PORTALS:+${ZONE_PORTALS//,/ }}; do
  echo "setZonePortal ${zp%%:*} legacy=${zp##*:}: $(send "$VAULT" 'setZonePortal(address,bool,bool)' "${zp%%:*}" true "${zp##*:}" --gas-limit 800000)"
done
if [ -n "${OWNER_ADDRESS:-}" ] && [ "$OWNER_ADDRESS" != "$DEPLOYER_ADDRESS" ]; then
  echo "transferOwnership (2-step; owner must accept): $(send "$REGISTRY" 'transferOwnership(address)' "$OWNER_ADDRESS" --gas-limit 300000) $(send "$VAULT" 'transferOwnership(address)' "$OWNER_ADDRESS" --gas-limit 300000)"
fi

mkdir -p deployments
BLOCK=$(cast block-number --rpc-url "$RPC_URL")
python3 - "$CHAIN_ID" "$REGISTRY" "$VAULT" "$DEPLOYER_ADDRESS" "$ARBITER_ADDRESS" "$INTAKE_ADDRESS" "$VERIFIER_ADDRESS" "$BLOCK" "$REG_TX" "$VAULT_TX" "$TOKENS" <<'EOF'
import json, sys
c, reg, vault, owner, arb, intake, ver, block, regtx, vaulttx, tokens = sys.argv[1:]
json.dump({
  "chainId": int(c), "VerifierRegistry": reg, "Vault": vault, "owner": owner, "arbiter": arb, "intake": intake, "verifier": ver,
  "block": int(block), "tokens": tokens.strip("[]").split(","), "txs": {"VerifierRegistry": regtx, "Vault": vaulttx},
}, open(f"deployments/{c}.json", "w"), indent=2)
print(f"wrote deployments/{c}.json")
EOF
echo "next: copy the addresses into packages/abi/addresses.json"
