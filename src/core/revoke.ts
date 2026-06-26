// Revocation pipeline — publishes nullifier, removes commitment from the valid set,
// updates the Merkle root. (Stub) broadcasts revoke tx via casper-js-sdk (PEM key).
// Autonomous revocation is the headline demo moment.

import { generateNullifier } from "./poseidon";
import type { IssuanceState } from "./issue";
import type { PoseidonHash, RiskEvent } from "./types";

// ── Revocation State ───────────────────────────────────────────────────────

export interface RevocationState {
  /** Set of revoked nullifier hashes. */
  revokedNullifiers: Set<PoseidonHash>;
  /** Revocation events log. */
  events: RiskEvent[];
}

export function createRevocationState(): RevocationState {
  return {
    revokedNullifiers: new Set(),
    events: [],
  };
}

// ── Revocation Flow ────────────────────────────────────────────────────────

export interface RevokeResult {
  holderId: string;
  nullifierHash: PoseidonHash;
  newRoot: PoseidonHash;
  deployHash: string;
}

/**
 * Revoke a holder's credential.
 * 1. Publish the nullifier (so their proof stops verifying).
 * 2. Remove the commitment from the Merkle tree (update root).
 * 3. (Stub) Broadcast revoke tx via casper-js-sdk (PEM key).
 */
export function revokeHolder(
  issuanceState: IssuanceState,
  revocationState: RevocationState,
  holderId: string,
  context: string,
  riskEvent: RiskEvent,
): RevokeResult {
  const holder = issuanceState.holders.get(holderId);
  if (!holder) {
    throw new Error(`Unknown holder: ${holderId}`);
  }
  if (holder.status === "revoked") {
    throw new Error(`Holder ${holderId} is already revoked.`);
  }
  if (holder.status === "declined") {
    throw new Error(`Holder ${holderId} was never issued a credential.`);
  }
  if (!holder.commitment) {
    throw new Error(`Holder ${holderId} has no commitment to revoke.`);
  }

  // 1. Derive and publish the nullifier.
  const nullifierHash = generateNullifier(holder.commitment.secret, context);
  revocationState.revokedNullifiers.add(nullifierHash);

  // 2. Remove the commitment from the Merkle tree.
  const leafIndex = issuanceState.tree.indexOf(holder.commitment.hash);
  if (leafIndex >= 0) {
    issuanceState.tree.remove(leafIndex);
  }

  // 3. Update holder state.
  holder.status = "revoked";
  holder.riskEvents.push(riskEvent);

  // 4. (Stub) Broadcast revoke tx via casper-js-sdk (PEM key).
  // In production: casper-js-sdk `revoke(nullifierHash, reason_code)` via PEM key → real deploy hash.
  const mockDeployHash = `0x${Buffer.from(`revoke-${holderId}-${Date.now()}`).toString("hex").slice(0, 64).padEnd(64, "0")}`;
  holder.deployHashes.revocation = mockDeployHash;
  riskEvent.deployHash = mockDeployHash;

  // 5. Log the event.
  revocationState.events.push(riskEvent);

  return {
    holderId,
    nullifierHash,
    newRoot: issuanceState.tree.root,
    deployHash: mockDeployHash,
  };
}

/**
 * Check if a nullifier has been revoked.
 */
export function isRevoked(revocationState: RevocationState, nullifierHash: PoseidonHash): boolean {
  return revocationState.revokedNullifiers.has(nullifierHash);
}

/**
 * Get all revoked nullifiers.
 */
export function getRevokedNullifiers(revocationState: RevocationState): PoseidonHash[] {
  return [...revocationState.revokedNullifiers];
}
