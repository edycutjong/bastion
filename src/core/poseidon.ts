// Simulated Poseidon hash for the deterministic demo.
// Uses sha256 under the hood — same API shape as circomlibjs Poseidon so the
// real implementation is a drop-in replacement. The commitment scheme and
// nullifier derivation are cryptographically correct in structure.

import { createHash } from "node:crypto";
import type { PoseidonHash } from "./types";

/**
 * Poseidon-like hash of arbitrary inputs. Returns a 0x-prefixed hex string.
 * In production, replace with circomlibjs `buildPoseidon()` for field-element-native hashing.
 */
export function poseidonHash(...inputs: string[]): PoseidonHash {
  const h = createHash("sha256");
  for (const input of inputs) {
    // Length-prefix each input to prevent collision between e.g. ["ab","c"] and ["a","bc"].
    const buf = Buffer.from(input, "utf8");
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(buf.length);
    h.update(lenBuf);
    h.update(buf);
  }
  return `0x${h.digest("hex")}`;
}

/**
 * Generate a credential commitment: H(secret, attributesHash).
 * The holder keeps `secret` off-chain; the chain only sees the commitment hash.
 */
export function generateCommitment(secret: string, attributesHash: PoseidonHash): PoseidonHash {
  return poseidonHash(secret, attributesHash);
}

/**
 * Derive a nullifier hash: H(secret, context).
 * Prevents double-use and enables targeted revocation.
 */
export function generateNullifier(secret: string, context: string): PoseidonHash {
  return poseidonHash(secret, "nullifier", context);
}

/**
 * Hash an attribute set to produce an attributesHash for the commitment.
 * Deterministic: sorted keys → stable hash.
 */
export function hashAttributes(attributes: Record<string, string>): PoseidonHash {
  const sorted = Object.keys(attributes)
    .sort()
    .map((k) => `${k}=${attributes[k]}`)
    .join("|");
  return poseidonHash("attributes", sorted);
}
