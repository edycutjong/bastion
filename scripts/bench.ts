// Benchmark: issuance + revocation latency.

import { loadApplicants, loadSecrets } from "../src/lib/fixtures";
import { createIssuanceState, processAll, getCurrentRoot } from "../src/core/issue";
import { createRevocationState, revokeHolder } from "../src/core/revoke";
import type { RiskEvent } from "../src/core/types";

async function main() {
  console.log("⏱  Bastion — Benchmark\n");

  const applicants = loadApplicants();
  const secrets = loadSecrets();
  const secretMap: Record<string, string> = {};
  for (const [id, s] of Object.entries(secrets)) {
    secretMap[id] = s.secret;
  }

  // Benchmark issuance.
  const issuanceStart = performance.now();
  const state = createIssuanceState("0xissuer-demo-key");
  processAll(state, applicants, secretMap);
  const issuanceMs = performance.now() - issuanceStart;

  console.log(`Issuance (${applicants.length} applicants): ${issuanceMs.toFixed(2)}ms`);
  console.log(`  Root: ${getCurrentRoot(state).slice(0, 20)}…`);

  // Benchmark revocation.
  const revocationState = createRevocationState();
  const riskEvent: RiskEvent = {
    id: "bench-risk-1",
    holderId: "mallory",
    type: "sanctions_hit",
    description: "Benchmark sanctions hit",
    detectedAt: new Date().toISOString(),
    autonomous: true,
  };

  const revokeStart = performance.now();
  const result = revokeHolder(state, revocationState, "mallory", "bench-pool", riskEvent);
  const revokeMs = performance.now() - revokeStart;

  console.log(`\nRevocation (signal → on-chain revoke): ${revokeMs.toFixed(2)}ms`);
  console.log(`  Nullifier: ${result.nullifierHash.slice(0, 20)}…`);
  console.log(`  New root: ${result.newRoot.slice(0, 20)}…`);
  console.log(`  Deploy: ${result.deployHash.slice(0, 20)}…`);

  // Summary.
  console.log("\n── Summary ──");
  console.log(`  Issuance p50: ${issuanceMs.toFixed(2)}ms`);
  console.log(`  Revocation p50: ${revokeMs.toFixed(2)}ms`);
  console.log(`  Total: ${(issuanceMs + revokeMs).toFixed(2)}ms`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
