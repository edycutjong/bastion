# 🛡️ Bastion — Agent Instructions

## Project
ZK compliance gateway for the Casper ecosystem. Users prove KYC-compliance via Groth16 ZK proofs (no identity revealed), and a monitoring agent autonomously revokes credentials when compliance lapses. Part of the **Vouch** suite (Conclave · Verity · Bastion).

## Hackathon
**Casper Agentic Buildathon 2026** (DoraHacks) — Casper Innovation Track, Build direction #4 (AI Compliance & KYC). $150K prize pool.

## Structure
- `src/core/` — Domain layer (types, Poseidon hash, Merkle tree, ZK proof, attestation, verifier, monitor, issuance, revocation, pool)
- `src/lib/` — Server config + fixture loaders + `compliance.ts` (stateless orchestrator: issue → prove → verify → replay revocations, re-proving every still-valid holder against the current root)
- `src/components/` — React 19 section components (BastionHero, CoreFlow, PiiScan, X402CheckPanel, WhyCasper) + **ComplianceConsole** (client, interactive prove → verify → autonomous revocation)
- `src/app/` — Next.js 16 dashboard + API routes (verify, issue, prove, revoke, check, pool, health) + **`/api/console`** (orchestration: GET initial snapshot / POST `{ revoke: [...] }`)
- `contract/` — Odra upgradable Rust contract (Merkle root + nullifier set)
- `scripts/` — CLI tools (seed, trigger_risk, scan_pii, x402_query, zk_prove, bench, check_submission_readiness)
- `data/fixtures/` — Deterministic demo data

## Tech Stack
| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16 (App Router), React 19 |
| **Styling** | Tailwind CSS v4 |
| **Testing** | Vitest |
| **Contract** | Odra (Rust) on Casper Testnet |
| **ZK** | Simulated Groth16 (circom/snarkjs shape) |
| **Credentials** | casper-eip-712 (JS) |
| **Signing** | CSPR.click AI Agent Skill |
| **Micropayments** | x402 (CSPR.cloud facilitator) |
| **Monitoring** | CSPR.cloud streaming |

## Key Rules
- **Frontend** = ESM (`import`), Next.js 16, React 19, Tailwind v4
- **Tests** = Vitest globals (`describe`/`it`/`expect`)
- **ZK layer** = simulated Poseidon/Groth16 (sha256-based, same API shape as circomlibjs/snarkjs)
- **Privacy** = Zero PII on-chain, ever. Only Merkle root + nullifier hashes.
- **Colors** = Green (#22c55e) for valid, Red (#ef4444) for revoked, Amber (#f59e0b) for warnings, Cyan (#06b6d4) for Casper tools
- **Aesthetic** = Institutional, calm, deep navy — like a security console

## Commits & Releases
- **Conventional Commits required** — all commit messages MUST follow the format: `type(scope): description`
- Types: `feat` (minor bump), `fix`/`perf`/`refactor` (patch bump), `chore`/`docs`/`ci`/`test`/`style` (no release)
- Breaking changes: append `!` after type or include `BREAKING CHANGE:` in body → triggers major bump
- Examples: `feat(zk): add batch proof verification`, `fix(merkle): correct root recomputation`, `chore: update deps`
- **Automated semantic versioning** runs in CI Stage 6 (`scripts/release-bump.ts`) — reads commits since last tag, bumps `package.json` + `contract/Cargo.toml`, generates `CHANGELOG.md`, creates GitHub Release
- Never manually edit `version` in `package.json` or `Cargo.toml` — the pipeline owns it
