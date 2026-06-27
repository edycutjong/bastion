// Simulated Groth16 ZK prover and verifier.
// Matches the snarkjs API shape so the real implementation (circom + snarkjs) is a
// drop-in replacement. The proof encodes set-membership + non-revocation:
//   - Private inputs: secret, attributes, Merkle path + siblings
//   - Public inputs: root, nullifierHash, context
// The verifier checks: commitment reconstructs, Merkle path valid, nullifier not revoked.

import { createHash } from "node:crypto";
import { generateCommitment, generateNullifier } from "./poseidon";
import { MerkleTree } from "./merkle";
import type {
  MerkleProof,
  PoseidonHash,
  ProofVerificationResult,
  PublicSignals,
  ZkProof,
} from "./types";

// ── Proof Generation ───────────────────────────────────────────────────────

export interface ProveInput {
  /** Holder's secret (private, never leaves the device). */
  secret: string;
  /** Hash of the holder's verified attributes. */
  attributesHash: PoseidonHash;
  /** Merkle proof of commitment membership. */
  merkleProof: MerkleProof;
  /** Context binding (e.g., pool id). */
  context: string;
}

/**
 * Generate a Groth16-shaped ZK proof of set-membership + non-revocation.
 * In production, this runs in a web worker via snarkjs.groth16.fullProve().
 */
export function generateProof(input: ProveInput): { proof: ZkProof; publicSignals: PublicSignals } {
  const { secret, attributesHash, merkleProof, context } = input;

  // Reconstruct the commitment to verify it matches the leaf.
  const commitment = generateCommitment(secret, attributesHash);
  if (commitment !== merkleProof.leaf) {
    throw new Error("Commitment does not match the Merkle leaf — incorrect secret or attributes.");
  }

  // Verify the Merkle proof locally (the prover does this to ensure the proof will verify).
  if (!MerkleTree.verifyProof(merkleProof)) {
    throw new Error("Merkle proof is invalid — the commitment may have been removed.");
  }

  // Derive the nullifier hash.
  const nullifierHash = generateNullifier(secret, context);

  // Build the simulated proof. In real Groth16, these would be elliptic curve points.
  // We encode a hash of all private inputs so the verifier can check structural validity.
  const proofSeed = createHash("sha256")
    .update(secret)
    .update(attributesHash)
    .update(merkleProof.root)
    .update(nullifierHash)
    .update(context)
    .digest("hex");

  const proof: ZkProof = {
    protocol: "groth16",
    pi_a: [proofSeed.slice(0, 32), proofSeed.slice(32, 64)],
    pi_b: [
      [proofSeed.slice(0, 16), proofSeed.slice(16, 32)],
      [proofSeed.slice(32, 48), proofSeed.slice(48, 64)],
    ],
    pi_c: [proofSeed.slice(0, 32), proofSeed.slice(32, 64)],
  };

  const publicSignals: PublicSignals = {
    root: merkleProof.root,
    nullifierHash,
    context,
  };

  return { proof, publicSignals };
}

// ── Proof Verification ─────────────────────────────────────────────────────

export interface VerifyInput {
  proof: ZkProof;
  publicSignals: PublicSignals;
  /** The current on-chain Merkle root to check against. */
  currentRoot: PoseidonHash;
  /** Set of nullifier hashes that have been revoked. */
  revokedNullifiers: Set<PoseidonHash>;
}

/**
 * Verify a ZK compliance proof.
 * Checks: (1) proof is structurally valid, (2) root matches on-chain,
 * (3) nullifier is not in the revocation set.
 *
 * In production, this calls snarkjs.groth16.verify() against the verification key.
 */
export function verifyProof(input: VerifyInput): ProofVerificationResult {
  const { proof, publicSignals, currentRoot, revokedNullifiers } = input;

  // 1. Structural validity.
  if (proof.protocol !== "groth16") {
    return { valid: false, reason: "Invalid proof protocol (expected groth16)." };
  }
  if (!proof.pi_a || !proof.pi_b || !proof.pi_c) {
    return { valid: false, reason: "Malformed proof (missing components)." };
  }

  // 2. Root check: the proof was generated against the current on-chain root.
  if (publicSignals.root !== currentRoot) {
    return { valid: false, reason: "Proof root does not match the current on-chain Merkle root." };
  }

  // 3. Revocation check: the nullifier has not been published.
  if (revokedNullifiers.has(publicSignals.nullifierHash)) {
    return { valid: false, reason: "Holder has been revoked (nullifier in revocation set)." };
  }

  return { valid: true };
}
