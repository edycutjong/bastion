# Bastion — "Why ONLY Casper" Defense Brief

> Verified against the local `crawl/` source (casper-eip-712 digest incl. gasless permit pattern, Odra upgradable-contract tutorial, CSPR.click skill, x402 facilitator reference).

| # | Casper capability | Used for | Code location | Without it you'd need |
|---|---|---|---|---|
| 1 | **casper-eip-712** (typed-data `signTypedData`, JS; gasless permit pattern) | Issue compliance credentials off-chain, no PII, no gas for the user | `core/attest.ts` | A custom signature scheme + on-chain verifier + a gas-relayer you build yourself |
| 2 | **Odra upgradable contract** (Merkle root + nullifier/revocation set) | The on-chain set a ZK proof is checked against, and revoked from | `contract/src/bastion.rs` | A static, non-upgradable contract that can't revoke — defeating the point |
| 3 | **CSPR.click AI Agent Skill** (`casper-js-sdk` TransactionV1) | Agent signs commitment-insert + autonomous revocation txs | `core/issue.ts`, `core/revoke.ts` | A bespoke keypair + deploy/broadcast pipeline |
| 4 | **x402 facilitator** (CEP-18, `casper:casper-test`) | dApps pay per ZK-proof verification / compliance check | `server/x402-check.ts` | A subscription billing system + API-key management |
| 5 | **CSPR.cloud APIs** (streaming) | Monitoring agent watches on-chain activity to trigger revocation | `core/monitor.ts` | A self-hosted node + event indexer |

## The argument
Bastion threads the needle institutions care about most — **compliance without surveillance** — and pairs Casper's primitives with a **real zero-knowledge layer**: **casper-eip-712** makes a credential issuable off-chain with **no PII and no gas** (the gasless-permit pattern that powers Uniswap approvals, now for compliance); the **Odra upgradable contract** holds the Merkle root + nullifier set that a **Groth16 ZK proof** is checked against, and that the agent **autonomously revokes** from; **CSPR.click** lets the agent insert/revoke without a human; and **x402** turns proof-verification into a per-call service other dApps consume without ever seeing an identity. The "wow" — a user **proving compliance in zero-knowledge**, then an agent **revoking access live** so the proof stops verifying — is built on Casper-native primitives plus circom/snarkjs. *(ZK is not a Casper feature; it's our layer on top — we don't claim Casper provides it.)*

**Take Casper out and you'd need:** a custom signature/relayer stack, a static contract that can't revoke, a bespoke deploy pipeline, a subscription billing system, and a self-hosted indexer — five systems, and you'd *still* be tempted to put PII on-chain.

## Honest limitations of the Casper tooling
- The ZK proofs are real Groth16 (circom/snarkjs), but MVP **verifies them in the gateway** against the on-chain Merkle root; a native on-chain Groth16 verifier entrypoint in Odra (pairing checks on Casper) is **roadmap**. We name this split precisely rather than implying end-to-end on-chain ZK.
- Odra upgradability is powerful but must be governed; we ship an explicit admin force-revoke + document the upgrade authority rather than pretending it's trustless.
- x402 is new/Go-first; we use it only for the *check* path so issuance/revocation/proving never depend on unproven infra.
