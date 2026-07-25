# Bastion — "Why ONLY Casper" Defense Brief

> Every row below maps to code you can open in this repo. Where a capability is
> simulated (the ZK layer) we say so explicitly — Bastion's edge is compliance
> *architecture* on Casper, not a claim to have shipped a production Groth16 prover.

| # | Casper capability | Used for | Code location | Without it you'd need |
|---|---|---|---|---|
| 1 | **Odra upgradable contract** (Merkle root + nullifier/revocation set) | The on-chain set a proof is checked against, and revoked from | `contract/src/bastion.rs` | A static, non-upgradable contract that can't revoke — defeating the point |
| 2 | **casper-js-sdk** (`PrivateKey.fromPem` → `ContractCallBuilder.byPackageHash` → `putTransaction`) | The agent signs & broadcasts `insert_commitment` + autonomous `revoke` txs | `src/lib/casper.ts`, `src/core/issue.ts`, `src/core/revoke.ts` | A bespoke keypair + deploy/broadcast pipeline |
| 3 | **x402 facilitator over CSPR.cloud** (`/verify` → `/settle`) | dApps pay per compliance check | `src/core/x402_facilitator.ts`, `src/app/api/check/route.ts` | A subscription billing system + API-key management |

## The argument
Bastion threads the needle institutions care about most — **compliance without
surveillance** — on Casper-native primitives: the **Odra upgradable contract**
holds the Merkle root + nullifier set that a set-membership proof is checked
against and that the monitor agent **autonomously revokes** from; **casper-js-sdk**
lets that agent insert and revoke on-chain without a human; and **x402** turns a
compliance check into a per-call service other dApps consume without ever seeing
an identity. The "wow" — a holder proving membership, then an agent revoking access
live so the proof stops verifying — runs against a real Casper contract with real
confirmed testnet transactions (`insert_commitment` + `revoke`, see the README
on-chain table and `deployments/testnet.json`).

**Take Casper out and you'd need:** a bespoke deploy/broadcast pipeline, a static
contract that can't revoke, and a subscription billing system — and you'd *still*
be tempted to put PII on-chain.

## Honest limitations (stated plainly)
- **The ZK layer is Groth16-*shaped*, not a real Groth16 prover.** `src/core/zk.ts`
  and `src/core/poseidon.ts` are SHA-256-based stand-ins that mirror the
  circom/snarkjs API surface (`pi_a/pi_b/pi_c`, public signals, nullifier). We do
  **not** claim a real pairing-based prover or an on-chain Groth16 verifier — a
  native Odra verifier entrypoint is **roadmap**. The novel, real part is the
  compliance flow (commitment → membership → autonomous revocation) on Casper; the
  cryptographic soundness of the proof itself is out of scope for the hackathon.
- **The credential attestation is a SHA-256 stand-in, not EIP-712.** `src/core/attest.ts`
  documents that it does not use `signTypedData`; it hashes the attestation payload.
  No `casper-eip-712` / `CSPR.click` dependency is used anywhere.
- **The monitor is a deterministic fixture check, not a live stream.** `src/core/monitor.ts`
  scans a seeded risk feed; CSPR.cloud is used for the x402 facilitator path, not
  for streaming monitoring.
- **x402 is exercised only on the *check* path**, gated behind `BASTION_DEMO=false`
  + full x402 env, so issuance/proving/revocation never depend on it.
