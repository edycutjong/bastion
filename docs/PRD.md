# Bastion — Product Requirements Document

> Part of the **Vouch** suite (Conclave · Verity · Bastion). **Build order: second** — cheapest reuse of the spine (casper-eip-712 JS + CSPR.click + a small upgradable Odra contract), x402 is a thin add-on, not load-bearing.

## Emotional Hook (first line)
*A compliance officer at an RWA fund has to choose between two bad options every morning: put customers' passports and bank details on a public ledger, or stay out of DeFi entirely — and she's tired of choosing.*

## Problem Statement
Real-world assets and institutional capital can't touch DeFi without KYC/AML — but doing KYC the obvious way means leaking personal data, and protocols that "store compliance on-chain" either dox their users or fake it. Worse, compliance isn't static: a wallet that was clean yesterday can hit a sanctions list today, and almost no on-chain system **revokes** access when that happens. Compliance vs. privacy is treated as a forced trade-off, and continuous monitoring barely exists.

## Solution Overview
**Bastion** is an agentic compliance gateway that lets a user **prove they are compliant in zero-knowledge** — without revealing who they are or which credential they hold — and that can be **revoked** the moment they're not:
- A user verifies **off-chain**; the agent issues a **gasless attestation** signed with **casper-eip-712** (no PII ever on-chain) **and** inserts a **credential commitment** (a Poseidon hash of the holder's secret + attributes) as a leaf in an on-chain **Merkle accumulator** held in an **upgradable Odra contract**.
- To enter a gated dApp, the holder generates a **Groth16 zero-knowledge proof** (circom + snarkjs) that their commitment is a member of the **current valid-set Merkle root** and their nullifier is **not revoked** — proving "I am a compliant, non-revoked user" while revealing **nothing** about identity or which leaf.
- A **monitoring agent** watches risk signals and **autonomously revokes** by removing the commitment / publishing its nullifier and updating the root — after which the holder can no longer produce a valid proof.
- Other dApps **pay per check** via **x402** to verify a proof / query status, and get only a boolean — never an identity.

Compliance *with* zero-knowledge privacy, that can be taken away the moment it's no longer true.

## Target Users
- **Primary:** Casper RWA tokenization platforms and DeFi protocols that need KYC'd users but cannot put PII on-chain.
- **Secondary:** Institutions that won't touch non-compliant rails, and other agents needing a compliance gate before transacting.

## The ONE core flow (narrow + deep)
> **User verifies off-chain → agent issues a gasless eip-712 credential + inserts a commitment into the on-chain Merkle set (PII stays off-chain) → holder generates a Groth16 ZK proof of "valid & non-revoked" to enter a gated pool, revealing no identity → monitoring agent detects a risk signal and autonomously REVOKES (updates the root / nullifier) → the holder's proof stops verifying and the pool ejects them — live.**

## Core Features (MVP)
1. **Agentic verification** — user submits documents off-chain; the agent verifies and decides.
2. **Gasless attestation + commitment** — credential issued via casper-eip-712 typed-data signature (no PII on-chain); a Poseidon **commitment** is inserted into the on-chain Merkle set.
3. **ZK compliance proof** — Groth16 circuit (circom + snarkjs) proving **set-membership + non-revocation** without revealing identity or leaf; verified against the on-chain Merkle root.
4. **Upgradable credential contract** — Odra contract holds the **Merkle root**, a **nullifier/revocation set**, and per-commitment `valid/revoked/expired`.
5. **Autonomous revocation** — monitoring agent revokes on a risk trigger (sanctions hit, anomalous activity), updating root/nullifier so the holder's proof stops verifying.
6. **x402 compliance check** — dApps pay per proof-verification / status query; boolean only.
7. **Gated demo pool** — a mock pool that admits only valid ZK proofs and **ejects on revocation**.

## User Stories
- *As an RWA platform,* I gate minting on a Bastion credential, so only KYC'd-but-private users can buy — without my contract ever seeing a passport.
- *As a compliance officer,* I watch a wallet get flagged and see Bastion **auto-revoke** it and eject it from the pool within seconds — continuous compliance, not a one-time checkbox.

## Success Metrics
- **≥1 real Testnet issuance tx and ≥1 real revocation tx**, both with explorer links (hard gate).
- **≥1 Groth16 ZK proof generated and verified** against the on-chain Merkle root (identity never revealed).
- **Zero PII on-chain** — verified by an audit script that scans contract state for any personal field.
- Revocation propagates to the gated pool in the demo (a revoked holder's proof fails to verify, 100% on fixtures).
- x402 compliance-check round-trip demonstrated (boolean returned, settlement hash shown).

## Out of Scope
- Real KYC vendor integration / real document OCR at production grade — MVP uses a mock verifier with engineered cases.
- **On-chain Groth16 verification inside the Odra contract** — MVP verifies the ZK proof in the gateway (snarkjs) against the **on-chain Merkle root + nullifier set**; native on-chain pairing verification on Casper is roadmap.
- Mainnet; native (non-facilitator) x402.

## Honest Limitations
- The ZK proofs are **real Groth16 set-membership + non-revocation proofs** (circom/snarkjs), so identity is never revealed. **However**, MVP verification happens in the gateway against the on-chain root/nullifier set — *full on-chain proof verification on Casper is roadmap*. We state this split precisely rather than implying end-to-end on-chain ZK.
- The monitoring agent's revocation is only as good as its risk feed; the contract's upgradability + explicit revocation set is the safety net, and a human admin can force-revoke.
- x402 is the newest dependency; the compliance *check* uses it, but issuance/revocation/proof-generation (the core) do **not** depend on x402.
