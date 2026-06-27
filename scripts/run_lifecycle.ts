// Real on-chain compliance lifecycle against a deployed Bastion contract.
//   insert_commitment (admit a holder) → revoke (autonomous revocation)
// Each step is a real TransactionV1 broadcast via casper-js-sdk; the script prints
// every deploy hash + cspr.live link. Run after the contract is deployed.
//
//   export $(grep -v '^#' .env.local | xargs)   # BASTION_DEMO=false + contract + key
//   pnpm tsx scripts/run_lifecycle.ts
//
// Commitment / nullifier / root values come from the same deterministic crypto core
// the app uses (src/lib/compliance.ts), so the on-chain state matches the dashboard.

import { buildSnapshot } from "../src/lib/compliance";
import { insertCommitmentOnChain, revokeOnChain } from "../src/lib/casper";

const REASON_SANCTIONS = 1;

async function step(label: string, p: Promise<{ deployHash: string; explorerUrl: string }>) {
  process.stdout.write(`→ ${label} … `);
  const { deployHash, explorerUrl } = await p;
  console.log(`ok\n   ${deployHash}\n   ${explorerUrl}`);
}

async function main() {
  if (process.env.BASTION_DEMO !== "false") {
    throw new Error("Set BASTION_DEMO=false (and the live env) to broadcast real transactions.");
  }

  const holderId = process.env.BASTION_HOLDER ?? "mallory";

  // 1. Initial world — the holder is valid; insert its commitment against the live root.
  const initial = buildSnapshot([]);
  const before = initial.holders.find((h) => h.id === holderId);
  if (!before || before.status !== "valid" || !before.commitmentHash) {
    throw new Error(`Holder ${holderId} is not a valid, insertable holder in the fixtures.`);
  }

  // 2. Post-revocation world — gives the published nullifier + the new root.
  const after = buildSnapshot([holderId]);
  const revoked = after.holders.find((h) => h.id === holderId)!;

  console.log(`Bastion lifecycle for holder "${holderId}"\n`);

  await step(
    "insert_commitment",
    insertCommitmentOnChain({
      commitment: before.commitmentHash,
      attestationSig: "eip712-issuance-demo",
      newRoot: initial.root,
    }),
  );

  await step(
    "revoke",
    revokeOnChain({
      nullifier: revoked.nullifierHash ?? "",
      commitment: before.commitmentHash,
      reasonCode: REASON_SANCTIONS,
      newRoot: after.root,
    }),
  );

  console.log(`\n✅ Lifecycle complete — ${holderId} admitted then autonomously revoked on-chain.`);
}

main().catch((e) => {
  console.error(`\n✗ ${e.message}`);
  process.exit(1);
});
