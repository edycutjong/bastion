# Bastion — Proof-of-Production Plan

## Live URL
- **Frontend:** `https://bastion-vouch.vercel.app` (Vercel) — verify flow + compliance console against Casper Testnet.

## On-chain deployment (hard gate)
- **Network:** Casper **Testnet** (`casper:casper-test`).
- **Contract:** upgradable Odra contract (Merkle root + nullifier set) — address in README.
- **Transactions produced:**
  1. `insert_commitment` → real credential-commitment insertion tx (deploy hash).
  2. `revoke` → real autonomous revocation tx (deploy hash) — the headline (invalidates the holder's ZK proof).
  3. **x402 settlement** → CEP-18 micropayment per proof-check (deploy hash).
- **Explorer:** all linked on `testnet.cspr.live`.

## Published artifacts
- **npm:** `@vouch/eip712-credentials` — a JS helper for issuing/verifying gasless casper-eip-712 compliance credentials.
- **npm:** `@vouch/zk-compliance` — the circom circuit + snarkjs prover/verifier for ZK set-membership + non-revocation compliance proofs (reusable privacy primitive for the ecosystem).
- **GitHub:** open-source repo, MIT, with `cargo-odra` upgradable contract, circom circuit, and setup scripts.

## Test targets
- **≥55 tests**, counted in README.
  - Contract: `insert_commitment` verifies eip-712 sig + updates root; revoke publishes nullifier; upgrade authority guarded; expired handling.
  - ZK: proof verifies for a valid leaf; **fails after revocation**; nullifier prevents double-use.
  - Privacy: `scan_pii` finds 0 PII fields (asserted in test).
  - Monitor: risk signal → revoke fires; pool ejects the holder whose proof no longer verifies.
- Coverage ≥70% on issuance/revocation/proof core.

## Benchmark
- `scripts/bench.ts` → issuance + revocation latency (signal→on-chain revoke) p50/p95; x402 query round-trip.

## Verify
- `scripts/scan_pii.ts` → asserts no PII in full contract state (the privacy guarantee).
- `scripts/trigger_risk.ts` → demonstrates autonomous revoke + ejection, prints deploy hash.
- `scripts/check_submission_readiness.ts` → fails on placeholders / missing hashes.

## Long-term / impact
- Bastion is the compliance pillar of **Vouch**. Roadmap: real KYC-vendor adapters, a **native on-chain Groth16 verifier** in Odra (so proof verification is fully on-chain, not gateway-side), multi-jurisdiction rule packs, mainnet. Pairs naturally with Verity (reputation) and Conclave (governance) under one trust layer.
- Socials: X/@VouchOnCasper, landing page, 6-month roadmap in README.
