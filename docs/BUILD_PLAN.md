# Bastion — Build Plan

> **Build order: second** (after Conclave ships). Cheapest reuse of the spine; x402 is a thin add-on so most of this is low-risk. ~4–5 build-days; round ends **June 30, 2026**.

## Priority order = the auto-revocation demo path
The single most important thing to make work early is **issue → gate → autonomous revoke → eject**. Build that spine first.

### Day 1 — On-chain spine
- `cargo odra new bastion`; **upgradable** contract (`insert_commitment`, `revoke`, `current_root`, `is_nullified`, `status`) with a Merkle root + nullifier set. Deploy to Testnet.
- Reuse `@vouch/conclave-mcp-tools` for CSPR.click; prove **one real commitment-insert tx** + **one real revoke tx** (deploy hashes). (Hard gate cleared Day 1.)

### Day 2 — Gasless issuance + ZK circuit
- casper-eip-712 credential signing (JS, gasless) → `insert_commitment`.
- **circom circuit** (Poseidon commitment, Merkle membership, nullifier) + `snarkjs` Groth16 setup; commit `bastion.zkey` + `verification_key.json`.
- `scripts/zk_prove.ts` — generate + verify a proof against `current_root()`. Off-chain encrypted PII vault (Supabase); `scripts/scan_pii.ts` (privacy proof).

### Day 3 — Monitor agent + the wow
- Monitor agent on CSPR.cloud streams + seeded sanctions feed → autonomous `revoke` via CSPR.click → revoked holder's **proof stops verifying**.
- Gated demo pool admits valid proofs and **ejects on revoke**.
- `scripts/seed.ts` (alice/carol) + `scripts/trigger_risk.ts` (mallory timeline).

### Day 4 — x402 check + UI
- x402-gated `POST /check {proof}` (reuse `@vouch/x402-casper-js` from Verity if built; else a minimal facilitator call). Boolean only.
- Compliance Console UI (ZK-entry flow, status chips, pool membership, risk banner, revoke deploy links, PII-scan button, x402 panel).

### Day 5 — Proof + submit
- `scripts/bench.ts`, `scripts/check_submission_readiness.ts`.
- Vercel deploy, README (test count, contract address, precise "PII-off-chain not ZK" honesty note), record ≤3-min demo, submit + CSPR.fans post.

## Must-have vs nice-to-have
| Must-have | Nice-to-have |
|---|---|
| Real commitment-insert + revocation txs | Real KYC vendor / OCR |
| Gasless eip-712 credential, **0 PII on-chain** | Native on-chain Groth16 verifier in Odra (roadmap) |
| **Groth16 ZK proof: verifies for valid, fails for revoked** | Multi-jurisdiction rule packs |
| Autonomous revoke → proof invalid → pool ejection | Reputation-linked tiers |
| PII scan proof + x402 proof-check | Credential expiry auto-renew flow |

## Mandatory deliverables
- `scripts/zk_prove.ts` (ZK proof gen+verify), `scripts/scan_pii.ts` (privacy proof), `scripts/trigger_risk.ts`, `scripts/bench.ts`, `scripts/check_submission_readiness.ts`, `DEMO.md`, `ARCHITECTURE.md`, landing page.

## Kill-switch checkpoints
- **Day 1:** no real insert+revoke txs → fix before anything else.
- **Day 2:** if the circom circuit + Groth16 proof doesn't verify reliably, fall back to a simpler hash-preimage membership proof (still ZK) and document; do not let ZK block the on-chain spine.
- **Day 3:** if autonomous revoke→eject isn't reliable, fall back to admin-triggered revoke (still on-chain) and document; the demo still lands.
- If x402 check is flaky, ship the proof-check as a signed read and note it — issuance/revocation/proving never depend on x402.
