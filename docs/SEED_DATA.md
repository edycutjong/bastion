# Bastion — Seed Data Design

## The ONE devastating demo moment
> **A holder proves compliance in zero-knowledge (revealing no identity) and is inside a gated pool. A sanctions signal hits. The Monitor agent autonomously REVOKES on-chain (updating the root / publishing the nullifier), the holder's ZK proof STOPS VERIFYING, and the pool EJECTS them — in seconds, with a real Testnet revocation deploy hash.** Continuous, private compliance you can watch enforce itself.

## Engineered cases (deterministic — `scripts/seed.ts`)
Three holders tell the whole story:
1. **`alice`** — clean docs → Verifier issues a `valid` credential (gasless eip-712) + inserts her Poseidon commitment → she generates a **Groth16 ZK proof** and is admitted to the gated pool. (Shows issuance + PII-free + ZK entry.)
2. **`mallory`** — valid at issuance + inside the pool, then a **scripted risk event** at t1 (seeded sanctions list) → Monitor auto-**revokes** (nullifier published / root updated) → her **proof stops verifying** → pool ejects. **(The headline.)**
3. **`carol`** — submits failing docs → Verifier **declines**; no commitment inserted → she **can never produce a valid proof**. (Shows the gate actually gates.)

## Fixtures (`data/fixtures/`)
- `applicants.json` — alice/mallory/carol document bundles (synthetic, no real PII).
- `secrets.json` — per-holder `secret` + derived Poseidon commitment + nullifier (Testnet demo only).
- `sanctions.json` — the seeded watchlist; mallory is added at t1 on the demo timeline.
- `expected_states.json` — exact `{valid|revoked|declined}` + **expected proof-verification result** per holder after each step (verify script target).
- Compiled circuit artifacts (`bastion.zkey`, `verification_key.json`, wasm) checked in for deterministic proving.
- Funded **Testnet issuer/admin account** + a **CEP-18 X402** token for the x402 check demo + a consumer account.

## Reproducibility
- `scripts/seed.ts` — issues alice (+commitment), declines carol, deterministically.
- `scripts/zk_prove.ts` — generates a Groth16 proof for a holder and verifies it against the on-chain root (prints pass/fail).
- `scripts/trigger_risk.ts` — adds mallory at t1 → Monitor revokes → re-running her proof now **fails**.
- `scripts/scan_pii.ts` — dumps full on-chain contract state and asserts **no field is PII** (only a root + nullifiers).
- `scripts/x402_query.ts` — runs one paid proof-check and prints the settlement deploy hash.

## What the data proves
Three things no checkbox-KYC demo can: (1) a user proves compliance in **zero-knowledge** — identity never revealed; (2) the chain holds **zero PII** (scan proves it — just a Merkle root); and (3) compliance is **continuous** — a holder who goes bad has their proof **invalidated autonomously**, on-chain, in real time. The scripted sanctions hit on `mallory` is the product.
