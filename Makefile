.PHONY: help install dev build test test-coverage ci check-submission bench contract-build contract-test contract-deploy e2e lighthouse security-scan

# Default target
help:
	@echo "🛡️  Bastion — Makefile Command Center"
	@echo ""
	@echo "Available commands:"
	@echo "  === General ==="
	@echo "    make install           Install all project dependencies"
	@echo "    make dev               Start Next.js development server"
	@echo "    make build             Build the Next.js production app"
	@echo "    make test              Run Jest/Vitest unit tests"
	@echo "    make test-coverage     Run unit tests with coverage report"
	@echo "    make ci                Run full CI checks (lint, typecheck, tests)"
	@echo "    make check-submission  Run pre-submission readiness validation"
	@echo "    make bench             Run issuance and revocation benchmark"
	@echo ""
	@echo "  === Smart Contract ==="
	@echo "    make contract-build    Compile Rust contract to WASM target"
	@echo "    make contract-test     Run Rust contract unit & VM tests"
	@echo "    make contract-deploy   Deploy Rust contract to Casper Testnet"
	@echo ""
	@echo "  === Quality Assurance ==="
	@echo "    make e2e               Run Playwright E2E integration tests"
	@echo "    make lighthouse        Run Lighthouse CI performance audit"
	@echo "    make security-scan     Run security audits and license compliance checks"

# ── General ───────────────────────────────────────────────────

install:
	@echo "📦 Installing workspace dependencies..."
	pnpm install

dev:
	@echo "⚡ Starting Next.js dev server..."
	pnpm run dev

build:
	@echo "🏗️  Building Next.js production bundles..."
	pnpm run build

test:
	@echo "🧪 Running unit tests..."
	pnpm run test

test-coverage:
	@echo "📊 Running unit tests with coverage..."
	pnpm run test:coverage

ci:
	@echo "🚨 Running CI validation pipeline..."
	pnpm run ci

check-submission:
	@echo "🏁 Checking submission readiness..."
	pnpm run check:submission

bench:
	@echo "⏱️  Running performance benchmarks..."
	pnpm run bench

# ── Smart Contract ─────────────────────────────────────────────

contract-build:
	@echo "🦀 Building Rust/Odra contract..."
	pnpm run contract:build

contract-test:
	@echo "🔬 Testing Rust/Odra contract..."
	pnpm run contract:test

contract-deploy:
	@echo "🚀 Deploying Rust/Odra contract to Casper Testnet..."
	pnpm run contract:deploy

# ── Quality Assurance ──────────────────────────────────────────

e2e:
	@echo "🎭 Running Playwright E2E tests (demo mode)..."
	npx playwright test

lighthouse:
	@echo "🔦 Running Lighthouse CI audit..."
	npx lhci autorun

security-scan:
	@echo "=== NPM AUDIT ==="
	pnpm audit --audit-level=high || true
	@echo ""
	@echo "=== LICENSE CHECK ==="
	npx license-checker --production --excludePrivatePackages --failOn "GPL-3.0;AGPL-3.0" --summary || true
