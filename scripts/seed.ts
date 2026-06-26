// Deterministic demo state. Issues alice + commitment, declines carol.
// Uses committed Testnet-only keypairs (data/keys/) for reproducibility.

import { loadApplicants, loadSecrets } from "../src/lib/fixtures";
import { createIssuanceState, processAll, getCurrentRoot } from "../src/core/issue";

async function main() {
  const applicants = loadApplicants();
  const secrets = loadSecrets();
  const secretMap: Record<string, string> = {};
  for (const [id, s] of Object.entries(secrets)) {
    secretMap[id] = s.secret;
  }

  console.log("🛡️  Bastion seed — issuing credentials + commitments\n");

  const state = createIssuanceState("0xissuer-demo-key");
  const results = processAll(state, applicants, secretMap);

  for (const r of results) {
    const icon = r.verification.decision === "approved" ? "✅" : "✕";
    console.log(`${icon} ${r.holderId}: ${r.verification.decision}`);
    if (r.credential) {
      console.log(`   credential: ${r.credential.signature.slice(0, 20)}…`);
      console.log(`   commitment: ${r.commitment?.hash.slice(0, 20)}…`);
      console.log(`   deploy:     ${r.deployHash?.slice(0, 20)}…`);
    } else {
      console.log(`   reason: ${r.verification.reason}`);
    }
  }

  console.log(`\nMerkle root: ${getCurrentRoot(state)}`);
  console.log(`Valid commitments: ${state.tree.size}`);
  console.log(`Holders tracked: ${state.holders.size}`);

  // TODO(Day 1-2): Write to on-chain contract via CSPR.click:
  //   - Fund issuer account from faucet
  //   - Deploy the Bastion Odra contract
  //   - Call insert_commitment for each approved applicant
  //   - Persist deploy hashes to data/state.json
  console.log("\n⚠ On-chain wiring not yet connected — see BUILD_PLAN Day 1-2.");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
