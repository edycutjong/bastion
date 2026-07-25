// Finals-window activity refresh: admit a fresh, unused holder then revoke it, as two
// real TransactionV1 broadcasts against the live Bastion contract — so the explorer
// shows current-week activity and both entrypoints (insert_commitment, revoke) are
// demonstrably working today.
//
// Uses an UNUSED valid holder (default "alice") so insert_commitment can't hit
// CommitmentExists (mallory was already inserted in the Jun lifecycle). On-chain state
// is anonymous by design (commitment hash + nullifier + u8 reason, no identity), and
// alice is not in the sanctions list, so the app narrates this as a manual operator
// revocation — no false "sanctions" claim.
//
//   export $(grep -v '^#' .env.local | xargs)   # BASTION_DEMO=false + contract + key
//   pnpm tsx scripts/refresh_activity.ts
//
// Polls each tx to SUCCESS before the next (revoke must see the insert finalized so the
// valid→revoked count transition lands).

import { buildSnapshot } from "../src/lib/compliance";
import { insertCommitmentOnChain, revokeOnChain } from "../src/lib/casper";

const POLL_NODE = process.env.REFRESH_POLL_NODE ?? "https://node.testnet.casper.network/rpc";
const REASON_MANUAL = 2; // ignored on-chain; app treats non-sanctioned holders as manual revoke

interface ExecutionResult {
  error_message?: string | null;
  Version2?: { error_message?: string | null };
}
interface TxInfoResponse {
  result?: {
    execution_info?: { execution_result?: ExecutionResult; block_height?: number } | null;
  };
}

async function rpc(method: string, params: unknown): Promise<TxInfoResponse> {
  const res = await fetch(POLL_NODE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  return (await res.json()) as TxInfoResponse;
}

async function waitForSuccess(hash: string, label: string): Promise<void> {
  for (let i = 0; i < 48; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const r = await rpc("info_get_transaction", { transaction_hash: { Version1: hash } });
    const info = r?.result?.execution_info;
    if (info && info.execution_result) {
      const err = info.execution_result?.Version2?.error_message ?? info.execution_result?.error_message;
      if (err) throw new Error(`${label} FAILED on-chain: ${err}`);
      console.log(`  ✓ ${label} confirmed SUCCESS (block ${info.block_height ?? "?"})`);
      return;
    }
    process.stdout.write(".");
  }
  throw new Error(`${label} not confirmed after timeout (${hash})`);
}

async function main() {
  if (process.env.BASTION_DEMO !== "false") {
    throw new Error("Set BASTION_DEMO=false (and the live env) to broadcast real transactions.");
  }
  const holderId = process.env.BASTION_HOLDER ?? "alice";

  const initial = buildSnapshot([]);
  const before = initial.holders.find((h) => h.id === holderId);
  if (!before || before.status !== "valid" || !before.commitmentHash) {
    throw new Error(`Holder ${holderId} is not a valid, insertable holder in the fixtures.`);
  }
  const after = buildSnapshot([holderId]);
  const revoked = after.holders.find((h) => h.id === holderId)!;

  console.log(`🛡️  Bastion activity refresh (LIVE) — admit "${holderId}" then revoke\n`);

  const ins = await insertCommitmentOnChain({
    commitment: before.commitmentHash,
    attestationSig: "eip712-issuance-finals-refresh",
    newRoot: initial.root,
  });
  console.log(`⛓ insert_commitment → ${ins.deployHash}\n   ${ins.explorerUrl}`);
  await waitForSuccess(ins.deployHash, "insert_commitment");

  const rev = await revokeOnChain({
    nullifier: revoked.nullifierHash ?? "",
    commitment: before.commitmentHash,
    reasonCode: REASON_MANUAL,
    newRoot: after.root,
  });
  console.log(`⛓ revoke → ${rev.deployHash}\n   ${rev.explorerUrl}`);
  await waitForSuccess(rev.deployHash, "revoke");

  console.log(`\n✅ Refresh complete — ${holderId} admitted then revoked on-chain this week.`);
  console.log(`   insert_commitment: ${ins.deployHash}`);
  console.log(`   revoke:            ${rev.deployHash}`);
}

main().catch((e) => {
  console.error(`\n✗ ${e.message}`);
  process.exit(1);
});
