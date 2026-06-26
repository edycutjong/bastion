# Bastion — Submission Copy

## Project title
**Bastion — compliance without surveillance, that can be revoked** (a Vouch project)

## Emotional Hook (first line)
A compliance officer at an RWA fund chooses between two bad options every morning — put customers' passports on a public ledger, or stay out of DeFi entirely — and she's tired of choosing.

## Short description (≤150 chars)
Prove you're KYC-compliant in zero-knowledge — no identity revealed — with a credential an agent autonomously revokes the moment you're not.

## Long description (~500 words)
Real-world assets and institutional money can't enter DeFi without KYC/AML — but the obvious way to do KYC on-chain means leaking personal data, and most "on-chain compliance" either doxes users or fakes it. And compliance isn't static: a wallet that's clean today can hit a sanctions list tomorrow, yet almost nothing on-chain **revokes** access when that happens. The industry treats compliance and privacy as a forced trade-off, and continuous monitoring barely exists.

**Bastion** refuses the trade-off with **zero-knowledge**. A user verifies **off-chain**; the agent issues a compliance **credential** signed with **casper-eip-712** (gasless, **no PII ever on-chain**) and inserts a **Poseidon commitment** into an on-chain Merkle set held by an **upgradable Odra contract** — the chain stores only a root and a nullifier set. To enter a gated dApp, the holder generates a **Groth16 zero-knowledge proof** (circom + snarkjs) that their commitment is valid and **not revoked**, proving "I'm compliant" while revealing **nothing** about who they are. A **monitoring agent** (via **CSPR.cloud streaming**) **autonomously revokes** by updating the root / publishing a nullifier — after which the holder's proof simply stops verifying. Other dApps **pay per check** via **x402** to verify a proof and get only a boolean, never an identity.

The demo makes it undeniable. **Alice** verifies, gets a gasless credential, and **proves compliance in zero-knowledge** to enter a gated RWA pool — a one-click on-chain scan shows **zero PII** (only a Merkle root). **Carol** fails verification and can never produce a valid proof. Then **Mallory**, already inside, hits a sanctions list — Bastion's monitor **autonomously revokes** her on-chain, her ZK proof **stops verifying**, and the pool **ejects her in seconds**, with a real Testnet deploy hash. Compliance that's private (ZK), revocable, and continuous — enforced by the chain, not a checkbox.

Bastion is the compliance pillar of **Vouch**, a trust layer for the agent economy on Casper. Conclave brings accountability to governance, Verity to data, Bastion to identity — three agents, one trust layer.

## Why ONLY Casper (cites specific features)
Bastion uses **5 Casper capabilities**: **casper-eip-712** for gasless, PII-free credential issuance (the same permit pattern behind Uniswap approvals); **Odra upgradable contracts** to hold the Merkle root + revocation set a credential is proven against and **revoked** from; **CSPR.click** (`casper-js-sdk` TransactionV1) for autonomous issue/revoke; **x402** for per-call proof verification; and **CSPR.cloud streaming** for the monitor. The **zero-knowledge layer** (Groth16 via circom/snarkjs) sits on top. **Take Casper out and you'd need a custom signature/relayer stack, a static contract that can't revoke, a bespoke deploy pipeline, a billing system, and a self-hosted indexer** — and you'd still be tempted to put PII on-chain. *Honest limitation:* the ZK proofs are real (Groth16 set-membership + non-revocation), but MVP verifies them in the gateway against the **on-chain Merkle root**; a native on-chain Groth16 verifier in Odra is roadmap, and we label that split precisely.

## Demo video script
See `DEMO.md` (≤3 min).

## Track / category
Casper Innovation Track — build direction **#4 AI-Driven Compliance & KYC via Zero-Knowledge** (real Groth16 set-membership + non-revocation proofs via circom/snarkjs; full on-chain verification on roadmap).

## On-chain proof
Upgradable Odra contract on Casper Testnet (Merkle root + nullifier set); real `insert_commitment` + autonomous `revoke` (+ x402 settlement) transactions; a **Groth16 ZK proof verified against the on-chain root**; deploy hashes in README; on-chain PII scan = 0 fields.

## Honest limitation
The ZK proofs are genuine (Groth16), but MVP verifies them in the gateway against the on-chain Merkle root rather than inside the contract (native on-chain verification is roadmap), and the monitor's revocation is only as good as its risk feed — so the contract ships an explicit admin force-revoke and a documented upgrade authority instead of claiming trustless perfection.

## Sign-off
Thank you for reviewing Bastion. — Edy, building Vouch on Casper.
