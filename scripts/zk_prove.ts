// Generate + verify a Groth16 ZK proof against the current Merkle root.
// Demonstrates the full ZK compliance proof lifecycle.

import { loadApplicants, loadSecrets } from "../src/lib/fixtures";
import { createIssuanceState, processAll, getCurrentRoot } from "../src/core/issue";
import { createRevocationState } from "../src/core/revoke";
import { generateProof, verifyProof } from "../src/core/zk";
import { hashAttributes } from "../src/core/poseidon";
import { verifyDocuments } from "../src/core/verify";

async function main() {
  console.log("🔐 Bastion — ZK Proof Generation + Verification\n");

  // Seed the state.
  const applicants = loadApplicants();
  const secrets = loadSecrets();
  const secretMap: Record<string, string> = {};
  for (const [id, s] of Object.entries(secrets)) {
    secretMap[id] = s.secret;
  }

  const state = createIssuanceState("0xissuer-demo-key");
  const revocationState = createRevocationState();
  processAll(state, applicants, secretMap);

  const poolContext = "bastion-rwa-pool-1";

  for (const [holderId, holder] of state.holders) {
    console.log(`── ${holderId} ──`);

    if (!holder.commitment) {
      console.log(`  Status: ${holder.status} (no commitment — can't produce a valid proof)`);
      console.log("");
      continue;
    }

    // Re-derive attributes to get the hash.
    const applicant = applicants.find((a) => a.id === holderId)!;
    const verification = verifyDocuments(applicant);
    const attributesHash = hashAttributes(verification.extractedAttributes!);

    // Generate Merkle proof.
    const leafIndex = state.tree.indexOf(holder.commitment.hash);
    const merkleProof = state.tree.generateProof(leafIndex);
    console.log(`  Merkle proof: leaf at index ${leafIndex}, root ${merkleProof.root.slice(0, 20)}…`);

    // Generate ZK proof.
    const { proof, publicSignals } = generateProof({
      secret: holder.commitment.secret,
      attributesHash,
      merkleProof,
      context: poolContext,
    });
    console.log(`  ZK proof: ${proof.protocol}, pi_a[0]=${proof.pi_a[0].slice(0, 16)}…`);
    console.log(`  Public signals: root=${publicSignals.root.slice(0, 16)}…, nullifier=${publicSignals.nullifierHash.slice(0, 16)}…`);

    // Verify ZK proof.
    const result = verifyProof({
      proof,
      publicSignals,
      currentRoot: getCurrentRoot(state),
      revokedNullifiers: revocationState.revokedNullifiers,
    });

    const icon = result.valid ? "✓" : "✕";
    console.log(`  Verification: ${icon} ${result.valid ? "PASS" : "FAIL"} ${result.reason ?? ""}`);
    console.log("");
  }

  console.log("✅ ZK proof lifecycle demonstrated. Identity never revealed.");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
