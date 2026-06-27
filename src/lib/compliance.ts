// Shared compliance orchestrator.
// Server-only. Rebuilds the whole compliance world from fixtures and replays a
// set of revocations, then re-proves every still-valid holder against the CURRENT
// Merkle root. Stateless by design (robust on serverless) — the caller carries the
// list of revoked holder ids, exactly as the on-chain nullifier set would.
//
// Uses the genuine core crypto: Poseidon commitments, a real Merkle tree, and the
// Groth16-shaped prove/verify. Only the deploy broadcast is stubbed.

import { loadApplicants, loadSecrets, loadSanctions } from "@/lib/fixtures";
import { createIssuanceState, processAll } from "@/core/issue";
import { generateProof, verifyProof } from "@/core/zk";
import { createRevocationState, revokeHolder } from "@/core/revoke";
import type { CredentialStatus, RiskEvent } from "@/core/types";

const CONTEXT = "bastion-rwa-pool-1";
const ISSUER = "0xbastion-issuer-demo";

export interface HolderView {
  id: string;
  status: CredentialStatus;
  documentType: string;
  nationality: string;
  proofVerifies: boolean;
  proofReason: string | null;
  inPool: boolean;
  commitmentHash: string | null;
  nullifierHash: string | null;
  revocationDeployHash: string | null;
  riskReason: string | null;
}

export interface ComplianceSnapshot {
  poolId: string;
  root: string;
  activeCount: number;
  totalHolders: number;
  revokedNullifiers: string[];
  /** Sanctioned holder id the monitor agent is watching, if any are valid. */
  watchHolderId: string | null;
  holders: HolderView[];
}

/**
 * Build a full compliance snapshot, having revoked the given holder ids.
 * @param revoke holder ids to revoke (replayed in order)
 */
export function buildSnapshot(revoke: string[] = []): ComplianceSnapshot {
  const applicants = loadApplicants();
  const secrets = loadSecrets();
  const sanctions = loadSanctions();

  const secretMap = Object.fromEntries(
    Object.entries(secrets).map(([id, v]) => [id, v.secret]),
  );

  // 1. Issue credentials + build the Merkle set of valid commitments.
  const issuance = createIssuanceState(ISSUER);
  processAll(issuance, applicants, secretMap);

  // 2. Replay revocations against the live tree (publishes nullifiers, updates root).
  const revocation = createRevocationState();
  const revokeInfo = new Map<string, { nullifierHash: string; deployHash: string; reason: string }>();
  for (const holderId of revoke) {
    const holder = issuance.holders.get(holderId);
    if (!holder || holder.status !== "valid") continue;
    const sanction = sanctions.entries.find((e) => e.holderId === holderId);
    const riskEvent: RiskEvent = {
      id: `risk-${holderId}-${revokeInfo.size}`,
      holderId,
      type: sanction ? "sanctions_hit" : "manual_revoke",
      description: sanction?.reason ?? "Manual revocation by compliance operator",
      detectedAt: new Date().toISOString(),
      autonomous: !!sanction,
    };
    const result = revokeHolder(issuance, revocation, holderId, CONTEXT, riskEvent);
    revokeInfo.set(holderId, {
      nullifierHash: result.nullifierHash,
      deployHash: result.deployHash,
      reason: riskEvent.description,
    });
  }

  const currentRoot = issuance.tree.root;

  // 3. Re-prove every still-valid holder against the current root; verify the rest.
  const holders: HolderView[] = applicants.map((applicant) => {
    const holder = issuance.holders.get(applicant.id)!;
    const base: HolderView = {
      id: applicant.id,
      status: holder.status,
      documentType: applicant.documents.documentType,
      nationality: applicant.documents.nationality,
      proofVerifies: false,
      proofReason: null,
      inPool: false,
      commitmentHash: holder.commitment?.hash ?? null,
      nullifierHash: null,
      revocationDeployHash: null,
      riskReason: null,
    };

    if (holder.status === "declined") {
      base.proofReason = "No credential issued — documents declined.";
      return base;
    }

    if (holder.status === "revoked") {
      const info = revokeInfo.get(applicant.id);
      base.proofReason = "Holder revoked — nullifier published, commitment removed.";
      base.nullifierHash = info?.nullifierHash ?? null;
      base.revocationDeployHash = info?.deployHash ?? null;
      base.riskReason = info?.reason ?? null;
      return base;
    }

    // Still valid: generate a fresh proof against the current tree and verify it.
    const leafIndex = issuance.tree.indexOf(holder.commitment!.hash);
    const merkleProof = issuance.tree.generateProof(leafIndex);
    const { proof, publicSignals } = generateProof({
      secret: holder.commitment!.secret,
      attributesHash: holder.commitment!.attributesHash,
      merkleProof,
      context: CONTEXT,
    });
    const result = verifyProof({
      proof,
      publicSignals,
      currentRoot,
      revokedNullifiers: revocation.revokedNullifiers,
    });

    base.proofVerifies = result.valid;
    base.proofReason = result.valid ? "Proof verifies against on-chain root." : (result.reason ?? null);
    base.inPool = result.valid;
    base.nullifierHash = publicSignals.nullifierHash;
    return base;
  });

  // Pick a sanctioned-but-still-valid holder for the monitor agent to watch.
  const watchHolderId =
    sanctions.entries
      .map((e) => e.holderId)
      .find((id) => holders.find((h) => h.id === id)?.status === "valid") ?? null;

  return {
    poolId: CONTEXT,
    root: currentRoot,
    activeCount: holders.filter((h) => h.inPool).length,
    totalHolders: holders.length,
    revokedNullifiers: [...revocation.revokedNullifiers],
    watchHolderId,
    holders,
  };
}
