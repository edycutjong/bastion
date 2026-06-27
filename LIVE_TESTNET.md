# Bastion — Live Testnet Wiring

Bastion ships in **demo mode** (real Poseidon/Merkle/Groth16-shape crypto, mock deploy
hashes). This runbook flips the chain-write paths to **Casper Testnet**:

| Path | Code | Activated by |
|---|---|---|
| **revoke (real tx)** | `src/app/api/revoke` → `src/lib/casper.ts` (casper-js-sdk v5) | `BASTION_DEMO=false` + funded issuer key + `BASTION_CONTRACT_HASH` |
| **x402 pay-to-check** | `src/app/api/check` → `src/core/x402_facilitator.ts` | `BASTION_DEMO=false` + facilitator env |

> casper-js-sdk surface verified against `@5.0.12` .d.ts. Confirm on first run:
> the deployed contract's `revoke(nullifier_hash:String, commitment_hash:String,
> reason_code:U64, new_root:String)` and `insert_commitment(commitment_hash:String,
> signature:String)` arg names match `src/lib/casper.ts`; and the x402 `/verify`+`/settle`
> body shapes match the make-software/casper-x402 Go reference.

---

## 1. Prerequisites
1. **CSPR.cloud token** — <https://cspr.cloud/>.
2. **Funded Ed25519 issuer key** — `casper-client keygen data/keys/issuer`, fund via the
   [Testnet faucet](https://testnet.cspr.live/tools/faucet).
3. **Deployed Merkle/nullifier contract** — build + deploy via the Odra livenet backend
   (`contract/bin/deploy.rs`, constructor `init(admin: Address)` → deployer):
   ```bash
   pnpm contract:build            # = cargo odra build → contract/wasm/Bastion.wasm
   cd contract
   export ODRA_CASPER_LIVENET_SECRET_KEY_PATH=./keys/secret_key.pem
   export ODRA_CASPER_LIVENET_NODE_ADDRESS=https://node.testnet.cspr.cloud
   export ODRA_CASPER_LIVENET_CHAIN_NAME=casper-test
   export ODRA_CASPER_LIVENET_EVENTS_URL=https://node.testnet.cspr.cloud/events
   pnpm contract:deploy           # = cargo run --bin bastion_livenet --features livenet
   # → prints "contract address : ..." → set BASTION_CONTRACT_HASH (prefix stripped).
   ```
4. **CEP-18 token + payee** for x402 pay-to-check (`X402_ASSET_PACKAGE`, `X402_PAYEE_ADDRESS`).

## 2. Configure `.env.local`
```ini
BASTION_DEMO=false
CSPR_CLOUD_API_KEY=<token>
CASPER_NODE_RPC=https://node.testnet.cspr.cloud/rpc
CASPER_CHAIN_NAME=casper-test
CASPER_ISSUER_SECRET_KEY_PATH=./data/keys/issuer/secret_key.pem
CASPER_KEY_ALGO=ed25519
BASTION_CONTRACT_HASH=hash-<deployed>
# x402
X402_FACILITATOR_URL=https://x402-facilitator.cspr.cloud
X402_ASSET_PACKAGE=<cep18 package hash, no hash- prefix>
X402_PAYEE_ADDRESS=<payee>
X402_CAIP2_CHAIN_ID=casper:casper-test
X402_CHECK_PRICE=$0.001
```

## 3. Verify each path

### Real autonomous revocation (the headline on-chain write)
```bash
pnpm build && pnpm start
curl -s -X POST http://localhost:3000/api/revoke \
  -H 'Content-Type: application/json' \
  -d '{"holderId":"mallory","nullifierHash":"0x..","commitmentHash":"0x..","reasonCode":1,"newRoot":"0x.."}' | jq
# → { status:"revoked", deployHash, explorerUrl, mode:"live" } with a REAL tx hash
#   on https://testnet.cspr.live/transaction/<deployHash>
```
(The Compliance Console's "Inject sanctions hit" drives `/api/console`; point its
revoke action at `/api/revoke` to broadcast on-chain in live mode.)

### Real x402 pay-to-check
```bash
curl -s -X POST http://localhost:3000/api/check -H 'Content-Type: application/json' \
  -d '{"proof":{...},"publicSignals":{...},"currentRoot":"0x..","revokedNullifiers":[]}'
# valid proof + no payment → 402 { accepts:[PaymentRequirements] }
# real x402 client retries with a base64 PaymentPayload in X-Payment →
# server verifies+settles via facilitator → 200 { compliant:true, settlementHash, mode:"live" }
```

## 4. Safety
`.env.local`, `data/keys/`, `*.pem` are git-ignored. Demo mode stays the default for judges.
