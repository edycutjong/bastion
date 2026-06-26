# Bastion — UI / Design

## Design language
Institutional, calm, trustworthy — deep navy + a single "clearance green / revoked red" status system, like a security console. The emotional beat is *watching access get pulled the instant a wallet goes bad.* Monospace for wallet hashes + deploy links.

## Screens

### 1. Verify + Prove (user)
- Stepper: submit documents (off-chain) → agent reviews → **credential issued + commitment inserted** → **Enter pool** generates a **Groth16 ZK proof** in-browser.
- Emphasize "**no data leaves as PII** — you hold a gasless credential and a secret; the chain sees only a Merkle root." A lock animation as the eip-712 signature is produced (no wallet popup, no gas), then a "proving…" shimmer as snarkjs runs locally — *the secret never leaves the device.*

### 2. Compliance Console (the money screen)
```
┌──────────────────────────────────────────────────────────┐
│  BASTION · Gated RWA Pool                  members: 2     │
├───────────────┬───────────────┬──────────────────────────┤
│ alice         │ mallory       │ carol                     │
│ ● VALID       │ ● VALID→…     │ ✕ DECLINED                │
│ in pool       │ in pool       │ never admitted            │
├───────────────┴───────────────┴──────────────────────────┤
│  ⚠ RISK SIGNAL: mallory added to sanctions list           │
│  → Monitor agent REVOKING…  ⛓ revoke deploy/0x…           │
│  ● mallory: REVOKED   → ejected from pool                 │
└──────────────────────────────────────────────────────────┘
```
- Live status chips flip valid→revoked with the real revocation deploy hash.
- The gated pool list updates in real time as the revocation lands (mallory drops out).
- A **"scan on-chain state"** button runs the PII audit and shows "0 PII fields found."

### 3. Pay-to-Check (x402 panel)
- A mock dApp submits a holder's **ZK proof** to `/check` → 402 → eip-712 pay → 200 boolean.
- Shows the boolean only (never identity) + the settlement deploy hash. Reinforces "verify the proof, learn nothing else."

## Mobile
- Vertical: credential/proof card → pool list → risk banner pinned. A 30-second clip of "prove in ZK → enter → sanctions hit → auto-revoke → proof fails → ejected" for CSPR.fans.

## Component list
`VerifyStepper`, `GaslessCredentialCard`, `ZkProveButton` (in-browser proving state), `StatusChip` (valid/revoked/expired/declined), `PoolMembership`, `RiskBanner`, `RevokeDeployLink`, `PiiScanButton`, `X402CheckPanel`.

## Assets to generate (manual, post-spec)
Hero: a castle bastion/portcullis lowering over a glowing wallet; OG tagline "Compliance without surveillance — and it can be taken away."
