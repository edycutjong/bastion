# Contributing to Bastion

Thanks for your interest in **Bastion** — a zero-knowledge compliance gateway
for the Casper ecosystem: admit holders by proof and revoke them autonomously on
a sanctions hit, with PII kept off-chain. This project was built for the Casper
Agentic Buildathon and is developed in the open. Bug reports, ideas, and pull
requests are all welcome.

## Code of Conduct

This project adheres to the [Contributor Covenant](CODE_OF_CONDUCT.md). By
participating, you are expected to uphold it. Report unacceptable behavior to
**edy.cu@live.com**.

## Tech Stack

- **App:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4
- **Smart contract:** Rust + [Odra](https://odra.dev) 2.x, deployed to Casper Testnet
- **Privacy:** Merkle-commitment + nullifier scheme, Groth16-shaped proofs (PII stays off-chain)
- **Tooling:** Node 22 · pnpm 10 · Rust nightly + cargo-odra · Vitest · Playwright

## Getting Started

```bash
pnpm install
cp .env.example .env.local   # the app runs in Demo Mode by default (no keys needed)
pnpm dev                     # http://localhost:3000
```

## Development Workflow

Before opening a pull request, make sure the local gate is green:

```bash
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint
pnpm test         # vitest
pnpm build        # next build
```

Smart-contract changes (Rust / Odra):

```bash
cd contract && cargo test
```

See [`LIVE_TESTNET.md`](LIVE_TESTNET.md) for wiring the app to a live Casper
Testnet contract, and [`deployments/testnet.json`](deployments/testnet.json) for
the deployed package hash and sample transactions.

## Pull Requests

1. Fork the repo and create a branch from `main` (`feat/…`, `fix/…`, `docs/…`).
2. Keep changes focused, and add or update tests for behavior changes.
3. Use [Conventional Commits](https://www.conventionalcommits.org/) for messages.
4. Make sure CI (build, lint, typecheck, tests, CodeQL) is green.
5. Fill out the pull request template.

## Reporting Bugs & Requesting Features

Open a [GitHub issue](../../issues/new/choose) using the provided templates. For
security vulnerabilities, do **not** open a public issue — follow
[SECURITY.md](SECURITY.md).

## Community

- Casper Developers on Telegram: <https://t.me/CSPRDevelopers>
- Casper Network Discord: <https://discord.com/invite/caspernetwork>

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](LICENSE).
