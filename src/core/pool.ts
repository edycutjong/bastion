// Gated demo pool — admits holders with valid ZK proofs, ejects on revocation.
// The pool is the visible surface where "proof stops verifying → ejected" plays out.

import { verifyProof, type VerifyInput } from "./zk";
import type { PoolMember, PoseidonHash, PublicSignals, ZkProof } from "./types";

// ── Pool State ─────────────────────────────────────────────────────────────

export interface PoolState {
  /** Pool identifier (used as context for nullifier binding). */
  poolId: string;
  /** Active and ejected members. */
  members: Map<string, PoolMember>;
}

export function createPool(poolId: string = "bastion-rwa-pool-1"): PoolState {
  return { poolId, members: new Map() };
}

// ── Pool Operations ────────────────────────────────────────────────────────

export interface AdmitResult {
  admitted: boolean;
  reason?: string;
}

/**
 * Attempt to admit a holder to the gated pool.
 * Requires a valid ZK proof of set-membership + non-revocation.
 */
export function admitToPool(
  pool: PoolState,
  holderId: string,
  proof: ZkProof,
  publicSignals: PublicSignals,
  currentRoot: PoseidonHash,
  revokedNullifiers: Set<PoseidonHash>,
): AdmitResult {
  // Check if already admitted.
  const existing = pool.members.get(holderId);
  if (existing?.active) {
    return { admitted: false, reason: "Holder is already in the pool." };
  }

  // Verify the ZK proof.
  const verifyInput: VerifyInput = { proof, publicSignals, currentRoot, revokedNullifiers };
  const result = verifyProof(verifyInput);

  if (!result.valid) {
    return { admitted: false, reason: result.reason };
  }

  // Check context binding (proof must be bound to this pool).
  if (publicSignals.context !== pool.poolId) {
    return { admitted: false, reason: `Proof is bound to a different pool (expected: ${pool.poolId}).` };
  }

  // Admit the holder.
  pool.members.set(holderId, {
    holderId,
    proof,
    publicSignals,
    admittedAt: new Date().toISOString(),
    active: true,
  });

  return { admitted: true };
}

/**
 * Eject a holder from the pool (called when their proof stops verifying).
 */
export function ejectFromPool(
  pool: PoolState,
  holderId: string,
  reason: string,
): boolean {
  const member = pool.members.get(holderId);
  if (!member || !member.active) return false;

  member.active = false;
  member.ejectedAt = new Date().toISOString();
  member.ejectionReason = reason;
  return true;
}

/**
 * Re-check all pool members against the revocation set and eject those whose
 * nullifiers have been revoked. Called after a revocation to enforce ejection.
 *
 * Note: We check only nullifier revocation, NOT root mismatch. The Merkle root
 * changes on every insert/remove, so all old proofs would fail root checks.
 * In production, members periodically re-prove; here, revocation is the enforcement signal.
 *
 * Returns the list of ejected holder IDs.
 */
export function enforcePool(
  pool: PoolState,
  _currentRoot: PoseidonHash,
  revokedNullifiers: Set<PoseidonHash>,
): string[] {
  const ejected: string[] = [];

  for (const [holderId, member] of pool.members) {
    if (!member.active) continue;

    // Check if the member's nullifier has been revoked.
    if (revokedNullifiers.has(member.publicSignals.nullifierHash)) {
      ejectFromPool(pool, holderId, "Holder has been revoked (nullifier in revocation set).");
      ejected.push(holderId);
    }
  }

  return ejected;
}

/**
 * Get the current pool membership count (active only).
 */
export function getActiveCount(pool: PoolState): number {
  let count = 0;
  for (const member of pool.members.values()) {
    if (member.active) count++;
  }
  return count;
}

/**
 * Get all pool members (active and ejected).
 */
export function getAllMembers(pool: PoolState): PoolMember[] {
  return [...pool.members.values()];
}

/**
 * Get active pool members only.
 */
export function getActiveMembers(pool: PoolState): PoolMember[] {
  return [...pool.members.values()].filter((m) => m.active);
}
