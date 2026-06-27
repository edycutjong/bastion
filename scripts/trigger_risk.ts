// Trigger the headline demo moment:
// 1. Seed the system (alice valid, mallory valid, carol declined).
// 2. Add mallory to the sanctions list.
// 3. Monitor agent detects → autonomous revoke → proof stops verifying → pool ejects.

import { loadApplicants, loadSecrets, loadSanctions } from "../src/lib/fixtures";
import { createIssuanceState, processAll, getCurrentRoot } from "../src/core/issue";
import { createRevocationState, revokeHolder } from "../src/core/revoke";
import { createPool, admitToPool, enforcePool, getActiveCount } from "../src/core/pool";
import { generateProof, verifyProof } from "../src/core/zk";
import { generateNullifier, hashAttributes } from "../src/core/poseidon";
import { createMonitorAgent, type RiskFeed } from "../src/core/monitor";
import { verifyDocuments } from "../src/core/verify";

async function main() {
  console.log("🛡️  Bastion — Risk Trigger Demo\n");

  // ── Phase 1: Seed ────────────────────────────────────────────────────
  const applicants = loadApplicants();
  const secrets = loadSecrets();
  const secretMap: Record<string, string> = {};
  for (const [id, s] of Object.entries(secrets)) {
    secretMap[id] = s.secret;
  }

  const issuanceState = createIssuanceState("0xissuer-demo-key");
  const revocationState = createRevocationState();
  const pool = createPool();

  processAll(issuanceState, applicants, secretMap);
  console.log("Phase 1: Credentials issued.");
  console.log(`  Merkle root: ${getCurrentRoot(issuanceState).slice(0, 20)}…`);

  // ── Phase 2: Admit valid holders to the pool ─────────────────────────
  for (const [holderId, holder] of issuanceState.holders) {
    if (holder.status !== "valid" || !holder.commitment) continue;

    const verification = verifyDocuments(applicants.find((a) => a.id === holderId)!);
    const attributesHash = hashAttributes(verification.extractedAttributes!);
    const leafIndex = issuanceState.tree.indexOf(holder.commitment.hash);
    const merkleProof = issuanceState.tree.generateProof(leafIndex);

    const { proof, publicSignals } = generateProof({
      secret: holder.commitment.secret,
      attributesHash,
      merkleProof,
      context: pool.poolId,
    });

    const result = admitToPool(
      pool, holderId, proof, publicSignals,
      getCurrentRoot(issuanceState), revocationState.revokedNullifiers,
    );
    console.log(`  ${holderId}: ${result.admitted ? "admitted to pool" : result.reason}`);
  }
  console.log(`  Pool members: ${getActiveCount(pool)}`);

  // ── Phase 3: Risk signal → autonomous revoke ─────────────────────────
  console.log("\nPhase 3: Sanctions signal detected…");
  const sanctions = loadSanctions();
  const feed: RiskFeed = { entries: sanctions.entries };

  const monitor = createMonitorAgent({
    holderIds: [...issuanceState.holders.keys()].filter(
      (id) => issuanceState.holders.get(id)?.status === "valid",
    ),
    feed,
    onRevoke: async (event) => {
      console.log(`  ⚠ RISK: ${event.holderId} — ${event.description}`);
      const result = revokeHolder(
        issuanceState, revocationState,
        event.holderId, pool.poolId, event,
      );
      console.log(`  → REVOKED: nullifier ${result.nullifierHash.slice(0, 20)}…`);
      console.log(`  → Deploy: ${result.deployHash.slice(0, 20)}…`);
      console.log(`  → New root: ${result.newRoot.slice(0, 20)}…`);
      return result.deployHash;
    },
  });

  const events = await monitor.start();
  console.log(`  Risk events processed: ${events.length}`);

  // ── Phase 4: Enforce pool → ejection ─────────────────────────────────
  console.log("\nPhase 4: Enforcing pool…");
  const ejected = enforcePool(pool, getCurrentRoot(issuanceState), revocationState.revokedNullifiers);
  console.log(`  Ejected: ${ejected.length > 0 ? ejected.join(", ") : "none"}`);
  console.log(`  Pool members remaining: ${getActiveCount(pool)}`);

  // ── Phase 5: Verify mallory's proof now fails ────────────────────────
  console.log("\nPhase 5: Verification after revocation…");
  for (const [holderId, holder] of issuanceState.holders) {
    if (!holder.commitment) {
      console.log(`  ${holderId}: no commitment (${holder.status})`);
      continue;
    }
    const nullifierHash = generateNullifier(holder.commitment.secret, pool.poolId);
    const proofResult = verifyProof({
      proof: { protocol: "groth16", pi_a: ["x"], pi_b: [["x"]], pi_c: ["x"] },
      publicSignals: {
        root: getCurrentRoot(issuanceState),
        nullifierHash,
        context: pool.poolId,
      },
      currentRoot: getCurrentRoot(issuanceState),
      revokedNullifiers: revocationState.revokedNullifiers,
    });
    const icon = proofResult.valid ? "✓" : "✕";
    console.log(`  ${icon} ${holderId}: proof ${proofResult.valid ? "VALID" : "FAILS"} — ${proofResult.reason ?? "ok"}`);
  }

  console.log("\n✅ Demo complete. The headline: mallory's proof stopped verifying and she was ejected.");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
