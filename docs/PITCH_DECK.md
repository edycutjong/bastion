# Bastion 🛡️ — Pitch Deck

> *Privacy-preserving compliance, enforced on-chain.*

---

## Slide 1: Title & Hook
**BASTION 🛡️** — Privacy-preserving compliance, enforced on-chain.
Part of the **Vouch** suite. Speaker Notes: "What if you could prove you're compliant without revealing who you are? That's Bastion."

## Slide 2: The Problem
**Centralized KYC creates massive PII data silos** — 4.1B records breached in 2024. Compliance requires identity exposure.

## Slide 3: The Solution
**ZK compliance gateway** — Groth16-shaped proofs prove set-membership without revealing PII. Autonomous revocation when compliance lapses.

## Slide 4: Core Flow
Issue credential → Merkle commitment → ZK proof → Verify → Monitor → Auto-revoke

## Slide 5: Architecture
Next.js 16 + Odra (Rust) + Groth16-sim + casper-js-sdk + CSPR.cloud streaming

## Slide 6: Demo Highlights
Compliance Console: inject sanctions hit → watch holder proof flip ✓→✗ → Merkle root recompute → pool eject

## Slide 7: Casper Integration
Odra contract, casper-js-sdk, x402 facilitator, CSPR.cloud streaming, casper-eip-712

## Slide 8: Testnet Proof
Contract: hash-d247c7..., CEP-18: hash-541069..., Issuer: 01b9c774...

## Slide 9: Competitive Edge
Only system where PII never touches the chain. ZK proofs + autonomous revocation.

## Slide 10: Roadmap
Now: Testnet prototype → 30d: Real Poseidon + snarkjs Groth16 → 60d: Mainnet → 90d: Multi-chain compliance

## Slide 11: Team
Edy Cu — Solo dev, 60+ hackathon projects, Vouch suite builder

## Slide 12: Conclusion
"Compliance without compromise. Privacy without permission."
