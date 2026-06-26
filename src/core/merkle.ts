// In-memory Merkle tree using the Poseidon hash.
// Depth-20 tree (supports ~1M leaves). Provides insert, remove, root, and
// membership proof generation. The root is what lands in the Odra contract.

import { poseidonHash } from "./poseidon";
import type { MerkleProof, PoseidonHash } from "./types";

const ZERO_LEAF = "0x" + "0".repeat(64);

/** Compute the zero hashes for each level of the tree (lazy cache). */
function computeZeroHashes(depth: number): PoseidonHash[] {
  const zeros: PoseidonHash[] = [ZERO_LEAF];
  for (let i = 1; i <= depth; i++) {
    zeros[i] = poseidonHash(zeros[i - 1], zeros[i - 1]);
  }
  return zeros;
}

export class MerkleTree {
  readonly depth: number;
  private leaves: PoseidonHash[];
  private readonly zeroHashes: PoseidonHash[];
  /** Layers[0] = leaves, layers[depth] = [root]. */
  private layers: PoseidonHash[][];

  constructor(depth: number = 20) {
    this.depth = depth;
    this.leaves = [];
    this.zeroHashes = computeZeroHashes(depth);
    this.layers = this.buildLayers();
  }

  /** Current Merkle root. */
  get root(): PoseidonHash {
    return this.layers[this.depth][0] ?? this.zeroHashes[this.depth];
  }

  /** Number of active (non-zero) leaves. */
  get size(): number {
    return this.leaves.length;
  }

  /** Insert a leaf and recompute the root. Returns the leaf index. */
  insert(leaf: PoseidonHash): number {
    const index = this.leaves.length;
    if (index >= 2 ** this.depth) {
      throw new Error(`Merkle tree full (max ${2 ** this.depth} leaves)`);
    }
    this.leaves.push(leaf);
    this.layers = this.buildLayers();
    return index;
  }

  /** Remove a leaf by setting it to ZERO_LEAF and recomputing. */
  remove(index: number): void {
    if (index < 0 || index >= this.leaves.length) {
      throw new Error(`Invalid leaf index: ${index}`);
    }
    this.leaves[index] = ZERO_LEAF;
    this.layers = this.buildLayers();
  }

  /** Check if a leaf exists (non-zero) in the tree. */
  hasLeaf(leaf: PoseidonHash): boolean {
    return this.leaves.includes(leaf);
  }

  /** Get the index of a leaf, or -1 if not found. */
  indexOf(leaf: PoseidonHash): number {
    return this.leaves.indexOf(leaf);
  }

  /** Generate a Merkle membership proof for the leaf at `index`. */
  generateProof(index: number): MerkleProof {
    if (index < 0 || index >= this.leaves.length) {
      throw new Error(`Invalid leaf index: ${index}`);
    }

    const pathIndices: number[] = [];
    const siblings: PoseidonHash[] = [];

    let currentIndex = index;
    for (let level = 0; level < this.depth; level++) {
      const isRight = currentIndex % 2;
      pathIndices.push(isRight);
      const siblingIndex = isRight ? currentIndex - 1 : currentIndex + 1;
      const layer = this.layers[level];
      siblings.push(
        siblingIndex < layer.length ? layer[siblingIndex] : this.zeroHashes[level],
      );
      currentIndex = Math.floor(currentIndex / 2);
    }

    return {
      leaf: this.leaves[index],
      root: this.root,
      pathIndices,
      siblings,
    };
  }

  /** Verify a Merkle proof against a given root. */
  static verifyProof(proof: MerkleProof): boolean {
    let current = proof.leaf;
    for (let i = 0; i < proof.pathIndices.length; i++) {
      const sibling = proof.siblings[i];
      if (proof.pathIndices[i] === 0) {
        current = poseidonHash(current, sibling);
      } else {
        current = poseidonHash(sibling, current);
      }
    }
    return current === proof.root;
  }

  /** Get all non-zero leaves. */
  getLeaves(): PoseidonHash[] {
    return this.leaves.filter((l) => l !== ZERO_LEAF);
  }

  // ── Private ────────────────────────────────────────────────────────────

  private buildLayers(): PoseidonHash[][] {
    const layers: PoseidonHash[][] = [
      [...this.leaves],
    ];

    for (let level = 0; level < this.depth; level++) {
      const prevLayer = layers[level];
      const nextLayer: PoseidonHash[] = [];
      const zeroForLevel = this.zeroHashes[level];

      // Pad to even length with the zero hash for this level.
      const padded = prevLayer.length % 2 === 0 ? prevLayer : [...prevLayer, zeroForLevel];

      for (let i = 0; i < padded.length; i += 2) {
        const left = padded[i] ?? zeroForLevel;
        const right = padded[i + 1] ?? zeroForLevel;
        nextLayer.push(poseidonHash(left, right));
      }

      // If empty, produce the zero hash for the next level.
      if (nextLayer.length === 0) {
        nextLayer.push(this.zeroHashes[level + 1]);
      }

      layers.push(nextLayer);
    }

    return layers;
  }
}
