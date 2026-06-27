import { describe, expect, it, beforeEach, vi } from "vitest";
import { poseidonHash, generateCommitment, generateNullifier, hashAttributes } from "./poseidon";
import { MerkleTree } from "./merkle";
import { generateProof, verifyProof } from "./zk";
import { issueCredential, verifyCredential, isExpired, generateIssuerKeypair } from "./attest";
import { verifyDocuments, decisionToStatus, verifyAll } from "./verify";
import { checkSanctions, scanForRisks, type RiskFeed, monitorPass, createMonitorAgent } from "./monitor";
import { createIssuanceState, processApplicant, getCurrentRoot, processAll } from "./issue";
import { createRevocationState, revokeHolder, isRevoked, getRevokedNullifiers } from "./revoke";
import { createPool, admitToPool, ejectFromPool, enforcePool, getActiveCount, getAllMembers, getActiveMembers } from "./pool";
import type { Applicant, MerkleProof } from "./types";

// ── Test Fixtures ──────────────────────────────────────────────────────────

const ALICE: Applicant = {
  id: "alice",
  documents: {
    fullName: "Alice Nakamura",
    nationality: "JP",
    documentType: "passport",
    documentNumber: "TK7829341",
    expiryDate: "2029-03-15",
    isAuthentic: true,
  },
  expectedOutcome: "valid",
};

const MALLORY: Applicant = {
  id: "mallory",
  documents: {
    fullName: "Mallory Reeves",
    nationality: "US",
    documentType: "passport",
    documentNumber: "MR5501827",
    expiryDate: "2028-11-22",
    isAuthentic: true,
  },
  expectedOutcome: "valid",
};

const CAROL: Applicant = {
  id: "carol",
  documents: {
    fullName: "Carol Dubois",
    nationality: "FR",
    documentType: "national_id",
    documentNumber: "EXPIRED-001",
    expiryDate: "2020-06-01",
    isAuthentic: false,
  },
  expectedOutcome: "declined",
};

const SECRETS = {
  alice: "alice-secret-demo",
  mallory: "mallory-secret-demo",
  carol: "carol-secret-demo",
};

const POOL_ID = "bastion-rwa-pool-1";

// ═══════════════════════════════════════════════════════════════════════════
// 1. Poseidon Hash
// ═══════════════════════════════════════════════════════════════════════════

describe("poseidonHash", () => {
  it("produces a 0x-prefixed hex string", () => {
    const h = poseidonHash("a", "b");
    expect(h).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("is deterministic", () => {
    expect(poseidonHash("x", "y")).toBe(poseidonHash("x", "y"));
  });

  it("changes when input changes", () => {
    expect(poseidonHash("a", "b")).not.toBe(poseidonHash("a", "c"));
  });

  it("is collision-resistant for different orderings", () => {
    expect(poseidonHash("ab", "c")).not.toBe(poseidonHash("a", "bc"));
  });
});

describe("generateCommitment", () => {
  it("produces a unique commitment for each secret", () => {
    const c1 = generateCommitment("s1", "0xattr");
    const c2 = generateCommitment("s2", "0xattr");
    expect(c1).not.toBe(c2);
  });

  it("is deterministic for the same inputs", () => {
    const c1 = generateCommitment("s", "0xa");
    const c2 = generateCommitment("s", "0xa");
    expect(c1).toBe(c2);
  });
});

describe("generateNullifier", () => {
  it("produces different nullifiers for different contexts", () => {
    const n1 = generateNullifier("s", "ctx1");
    const n2 = generateNullifier("s", "ctx2");
    expect(n1).not.toBe(n2);
  });

  it("is different from a commitment with the same inputs", () => {
    const c = generateCommitment("s", "ctx");
    const n = generateNullifier("s", "ctx");
    expect(c).not.toBe(n);
  });
});

describe("hashAttributes", () => {
  it("is stable regardless of key insertion order", () => {
    const h1 = hashAttributes({ a: "1", b: "2" });
    const h2 = hashAttributes({ b: "2", a: "1" });
    expect(h1).toBe(h2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. Merkle Tree
// ═══════════════════════════════════════════════════════════════════════════

describe("MerkleTree", () => {
  let tree: MerkleTree;

  beforeEach(() => {
    tree = new MerkleTree(4); // Small tree for tests.
  });

  it("starts with size 0", () => {
    expect(tree.size).toBe(0);
  });

  it("has a non-empty root even when empty", () => {
    expect(tree.root).toMatch(/^0x/);
  });

  it("root changes after insert", () => {
    const rootBefore = tree.root;
    tree.insert("0xleaf1");
    expect(tree.root).not.toBe(rootBefore);
  });

  it("tracks the correct size", () => {
    tree.insert("0xleaf1");
    tree.insert("0xleaf2");
    expect(tree.size).toBe(2);
  });

  it("finds a leaf by value", () => {
    tree.insert("0xleaf1");
    expect(tree.hasLeaf("0xleaf1")).toBe(true);
    expect(tree.hasLeaf("0xleaf2")).toBe(false);
  });

  it("returns the index of a leaf", () => {
    tree.insert("0xleafA");
    tree.insert("0xleafB");
    expect(tree.indexOf("0xleafA")).toBe(0);
    expect(tree.indexOf("0xleafB")).toBe(1);
  });

  it("removes a leaf and updates the root", () => {
    tree.insert("0xleafA");
    const rootAfterInsert = tree.root;
    tree.remove(0);
    expect(tree.root).not.toBe(rootAfterInsert);
  });

  it("generates a valid Merkle proof", () => {
    tree.insert("0xleaf1");
    tree.insert("0xleaf2");
    const proof = tree.generateProof(0);
    expect(MerkleTree.verifyProof(proof)).toBe(true);
  });

  it("proof fails for a different root", () => {
    tree.insert("0xleaf1");
    const proof = tree.generateProof(0);
    const badProof: MerkleProof = { ...proof, root: "0xbadroot" };
    expect(MerkleTree.verifyProof(badProof)).toBe(false);
  });

  it("proof fails for a tampered leaf", () => {
    tree.insert("0xleaf1");
    const proof = tree.generateProof(0);
    const badProof: MerkleProof = { ...proof, leaf: "0xtampered" };
    expect(MerkleTree.verifyProof(badProof)).toBe(false);
  });

  it("getLeaves returns only non-zero leaves", () => {
    tree.insert("0xA");
    tree.insert("0xB");
    tree.remove(0);
    const leaves = tree.getLeaves();
    expect(leaves).toHaveLength(1);
    expect(leaves[0]).toBe("0xB");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. ZK Proof (Groth16 Simulation)
// ═══════════════════════════════════════════════════════════════════════════

describe("ZK proof generation and verification", () => {
  it("generates a valid proof for a valid holder", () => {
    const tree = new MerkleTree(4);
    const attrs = hashAttributes({ nationality: "JP" });
    const commitment = generateCommitment(SECRETS.alice, attrs);
    tree.insert(commitment);
    const merkleProof = tree.generateProof(0);

    const { proof, publicSignals } = generateProof({
      secret: SECRETS.alice,
      attributesHash: attrs,
      merkleProof,
      context: POOL_ID,
    });

    const result = verifyProof({
      proof,
      publicSignals,
      currentRoot: tree.root,
      revokedNullifiers: new Set(),
    });

    expect(result.valid).toBe(true);
  });

  it("fails if the root doesn't match", () => {
    const tree = new MerkleTree(4);
    const attrs = hashAttributes({ nationality: "JP" });
    const commitment = generateCommitment(SECRETS.alice, attrs);
    tree.insert(commitment);
    const merkleProof = tree.generateProof(0);

    const { proof, publicSignals } = generateProof({
      secret: SECRETS.alice,
      attributesHash: attrs,
      merkleProof,
      context: POOL_ID,
    });

    const result = verifyProof({
      proof,
      publicSignals,
      currentRoot: "0xwrongroot",
      revokedNullifiers: new Set(),
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toContain("root");
  });

  it("fails if the nullifier is revoked", () => {
    const tree = new MerkleTree(4);
    const attrs = hashAttributes({ nationality: "JP" });
    const commitment = generateCommitment(SECRETS.alice, attrs);
    tree.insert(commitment);
    const merkleProof = tree.generateProof(0);

    const { proof, publicSignals } = generateProof({
      secret: SECRETS.alice,
      attributesHash: attrs,
      merkleProof,
      context: POOL_ID,
    });

    const nullifierHash = generateNullifier(SECRETS.alice, POOL_ID);
    const revokedSet = new Set([nullifierHash]);

    const result = verifyProof({
      proof,
      publicSignals,
      currentRoot: tree.root,
      revokedNullifiers: revokedSet,
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toContain("revoked");
  });

  it("rejects a malformed proof protocol", () => {
    const result = verifyProof({
      proof: { protocol: "fake" as "groth16", pi_a: [], pi_b: [], pi_c: [] },
      publicSignals: { root: "0x", nullifierHash: "0x", context: "" },
      currentRoot: "0x",
      revokedNullifiers: new Set(),
    });
    expect(result.valid).toBe(false);
  });

  it("throws when commitment doesn't match the leaf", () => {
    const tree = new MerkleTree(4);
    tree.insert("0xsomeleaf");
    const merkleProof = tree.generateProof(0);

    expect(() =>
      generateProof({
        secret: "wrong-secret",
        attributesHash: "0xwrongattr",
        merkleProof,
        context: POOL_ID,
      }),
    ).toThrow("Commitment does not match");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. EIP-712 Credentials
// ═══════════════════════════════════════════════════════════════════════════

describe("EIP-712 credential issuance", () => {
  it("issues a credential with a valid signature", () => {
    const cred = issueCredential({
      holder: "alice",
      attributesHash: "0xattrs",
      issuer: "0xissuer",
    });
    expect(cred.signature).toMatch(/^0x[0-9a-f]{64}$/);
    expect(cred.holder).toBe("alice");
    expect(cred.issuer).toBe("0xissuer");
  });

  it("verifies a freshly issued credential", () => {
    const cred = issueCredential({
      holder: "alice",
      attributesHash: "0xattrs",
      issuer: "0xissuer",
    });
    expect(verifyCredential(cred)).toBe(true);
  });

  it("detects a tampered credential", () => {
    const cred = issueCredential({
      holder: "alice",
      attributesHash: "0xattrs",
      issuer: "0xissuer",
    });
    const tampered = { ...cred, holder: "mallory" };
    expect(verifyCredential(tampered)).toBe(false);
  });

  it("correctly reports non-expired credential", () => {
    const cred = issueCredential({
      holder: "alice",
      attributesHash: "0xattrs",
      issuer: "0xissuer",
      validitySeconds: 3600,
    });
    expect(isExpired(cred)).toBe(false);
  });

  it("correctly reports expired credential", () => {
    const cred = issueCredential({
      holder: "alice",
      attributesHash: "0xattrs",
      issuer: "0xissuer",
      validitySeconds: -1, // Already expired.
    });
    expect(isExpired(cred)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. Verifier Agent
// ═══════════════════════════════════════════════════════════════════════════

describe("verifier agent", () => {
  it("approves alice (valid docs)", () => {
    const result = verifyDocuments(ALICE);
    expect(result.decision).toBe("approved");
    expect(result.extractedAttributes).toBeDefined();
  });

  it("declines carol (expired + inauthentic)", () => {
    const result = verifyDocuments(CAROL);
    expect(result.decision).toBe("declined");
    expect(result.reason).toContain("authenticity");
  });

  it("approves mallory (valid docs)", () => {
    const result = verifyDocuments(MALLORY);
    expect(result.decision).toBe("approved");
  });

  it("maps approved → valid", () => {
    expect(decisionToStatus("approved")).toBe("valid");
  });

  it("maps declined → declined", () => {
    expect(decisionToStatus("declined")).toBe("declined");
  });

  it("declines applicant with missing full name", () => {
    const bad: Applicant = {
      ...ALICE,
      id: "bad",
      documents: { ...ALICE.documents, fullName: "" },
    };
    expect(verifyDocuments(bad).decision).toBe("declined");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. Monitor Agent
// ═══════════════════════════════════════════════════════════════════════════

describe("monitor agent", () => {
  const feed: RiskFeed = {
    entries: [
      { holderId: "mallory", addedAt: "2026-06-11T12:00:00Z", reason: "Sanctions" },
    ],
  };

  it("detects mallory in the sanctions feed", () => {
    const match = checkSanctions("mallory", feed);
    expect(match).not.toBeNull();
    expect(match?.holderId).toBe("mallory");
  });

  it("does not flag alice", () => {
    expect(checkSanctions("alice", feed)).toBeNull();
  });

  it("scans and returns risk events for flagged holders", () => {
    const events = scanForRisks(["alice", "mallory"], feed);
    expect(events).toHaveLength(1);
    expect(events[0].holderId).toBe("mallory");
    expect(events[0].type).toBe("sanctions_hit");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. Issuance Pipeline
// ═══════════════════════════════════════════════════════════════════════════

describe("issuance pipeline", () => {
  it("processes alice as valid with commitment", () => {
    const state = createIssuanceState("0xissuer");
    const result = processApplicant(state, ALICE, SECRETS.alice);
    expect(result.verification.decision).toBe("approved");
    expect(result.credential).toBeDefined();
    expect(result.commitment).toBeDefined();
    expect(result.leafIndex).toBe(0);
    expect(result.deployHash).toMatch(/^0x/);
  });

  it("processes carol as declined with no commitment", () => {
    const state = createIssuanceState("0xissuer");
    const result = processApplicant(state, CAROL, SECRETS.carol);
    expect(result.verification.decision).toBe("declined");
    expect(result.credential).toBeUndefined();
    expect(result.commitment).toBeUndefined();
  });

  it("tracks holder state correctly", () => {
    const state = createIssuanceState("0xissuer");
    processApplicant(state, ALICE, SECRETS.alice);
    processApplicant(state, CAROL, SECRETS.carol);

    expect(state.holders.get("alice")?.status).toBe("valid");
    expect(state.holders.get("carol")?.status).toBe("declined");
  });

  it("Merkle root updates after each insert", () => {
    const state = createIssuanceState("0xissuer");
    const root0 = getCurrentRoot(state);
    processApplicant(state, ALICE, SECRETS.alice);
    const root1 = getCurrentRoot(state);
    processApplicant(state, MALLORY, SECRETS.mallory);
    const root2 = getCurrentRoot(state);

    expect(root1).not.toBe(root0);
    expect(root2).not.toBe(root1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. Revocation Pipeline
// ═══════════════════════════════════════════════════════════════════════════

describe("revocation pipeline", () => {
  it("revokes a valid holder", () => {
    const state = createIssuanceState("0xissuer");
    const revState = createRevocationState();
    processApplicant(state, MALLORY, SECRETS.mallory);

    const result = revokeHolder(state, revState, "mallory", POOL_ID, {
      id: "risk-1", holderId: "mallory", type: "sanctions_hit",
      description: "test", detectedAt: new Date().toISOString(), autonomous: true,
    });

    expect(result.nullifierHash).toMatch(/^0x/);
    expect(state.holders.get("mallory")?.status).toBe("revoked");
    expect(isRevoked(revState, result.nullifierHash)).toBe(true);
  });

  it("throws when revoking a declined holder", () => {
    const state = createIssuanceState("0xissuer");
    const revState = createRevocationState();
    processApplicant(state, CAROL, SECRETS.carol);

    expect(() =>
      revokeHolder(state, revState, "carol", POOL_ID, {
        id: "risk-2", holderId: "carol", type: "manual_revoke",
        description: "test", detectedAt: new Date().toISOString(), autonomous: false,
      }),
    ).toThrow("never issued");
  });

  it("throws when revoking an already-revoked holder", () => {
    const state = createIssuanceState("0xissuer");
    const revState = createRevocationState();
    processApplicant(state, MALLORY, SECRETS.mallory);

    revokeHolder(state, revState, "mallory", POOL_ID, {
      id: "r1", holderId: "mallory", type: "sanctions_hit",
      description: "first", detectedAt: new Date().toISOString(), autonomous: true,
    });

    expect(() =>
      revokeHolder(state, revState, "mallory", POOL_ID, {
        id: "r2", holderId: "mallory", type: "sanctions_hit",
        description: "second", detectedAt: new Date().toISOString(), autonomous: true,
      }),
    ).toThrow("already revoked");
  });

  it("getRevokedNullifiers returns all revoked", () => {
    const state = createIssuanceState("0xissuer");
    const revState = createRevocationState();
    processApplicant(state, MALLORY, SECRETS.mallory);
    revokeHolder(state, revState, "mallory", POOL_ID, {
      id: "r1", holderId: "mallory", type: "sanctions_hit",
      description: "test", detectedAt: new Date().toISOString(), autonomous: true,
    });

    expect(getRevokedNullifiers(revState).length).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. Gated Pool
// ═══════════════════════════════════════════════════════════════════════════

describe("gated pool", () => {
  function setupPoolWithMembers() {
    const state = createIssuanceState("0xissuer");
    const revState = createRevocationState();
    const pool = createPool(POOL_ID);

    // Process alice and mallory.
    processApplicant(state, ALICE, SECRETS.alice);
    processApplicant(state, MALLORY, SECRETS.mallory);

    // Admit both via ZK proof.
    for (const holderId of ["alice", "mallory"]) {
      const holder = state.holders.get(holderId)!;
      const v = verifyDocuments(holderId === "alice" ? ALICE : MALLORY);
      const attrs = hashAttributes(v.extractedAttributes!);
      const idx = state.tree.indexOf(holder.commitment!.hash);
      const mProof = state.tree.generateProof(idx);
      const { proof, publicSignals } = generateProof({
        secret: holder.commitment!.secret,
        attributesHash: attrs,
        merkleProof: mProof,
        context: POOL_ID,
      });
      admitToPool(pool, holderId, proof, publicSignals, getCurrentRoot(state), revState.revokedNullifiers);
    }

    return { state, revState, pool };
  }

  it("admits a valid holder", () => {
    const { pool } = setupPoolWithMembers();
    expect(getActiveCount(pool)).toBe(2);
  });

  it("rejects admission with wrong context", () => {
    const state = createIssuanceState("0xissuer");
    const revState = createRevocationState();
    const pool = createPool("different-pool");
    processApplicant(state, ALICE, SECRETS.alice);

    const holder = state.holders.get("alice")!;
    const v = verifyDocuments(ALICE);
    const attrs = hashAttributes(v.extractedAttributes!);
    const idx = state.tree.indexOf(holder.commitment!.hash);
    const mProof = state.tree.generateProof(idx);
    const { proof, publicSignals } = generateProof({
      secret: holder.commitment!.secret,
      attributesHash: attrs,
      merkleProof: mProof,
      context: POOL_ID, // Wrong context!
    });
    const result = admitToPool(pool, "alice", proof, publicSignals, getCurrentRoot(state), revState.revokedNullifiers);
    expect(result.admitted).toBe(false);
    expect(result.reason).toContain("different pool");
  });

  it("rejects double admission", () => {
    const { pool, state, revState } = setupPoolWithMembers();
    const holder = state.holders.get("alice")!;
    const v = verifyDocuments(ALICE);
    const attrs = hashAttributes(v.extractedAttributes!);
    const idx = state.tree.indexOf(holder.commitment!.hash);
    const mProof = state.tree.generateProof(idx);
    const { proof, publicSignals } = generateProof({
      secret: holder.commitment!.secret,
      attributesHash: attrs,
      merkleProof: mProof,
      context: POOL_ID,
    });
    const result = admitToPool(pool, "alice", proof, publicSignals, getCurrentRoot(state), revState.revokedNullifiers);
    expect(result.admitted).toBe(false);
    expect(result.reason).toContain("already");
  });

  it("ejects a holder", () => {
    const { pool } = setupPoolWithMembers();
    const ejected = ejectFromPool(pool, "mallory", "sanctions");
    expect(ejected).toBe(true);
    expect(getActiveCount(pool)).toBe(1);
  });

  it("enforcePool ejects revoked holders", () => {
    const { state, revState, pool } = setupPoolWithMembers();

    // Revoke mallory.
    revokeHolder(state, revState, "mallory", POOL_ID, {
      id: "r1", holderId: "mallory", type: "sanctions_hit",
      description: "sanctions", detectedAt: new Date().toISOString(), autonomous: true,
    });

    const ejected = enforcePool(pool, getCurrentRoot(state), revState.revokedNullifiers);
    expect(ejected).toContain("mallory");
    expect(getActiveCount(pool)).toBe(1);
  });

  it("getAllMembers includes ejected members", () => {
    const { pool } = setupPoolWithMembers();
    ejectFromPool(pool, "mallory", "test");
    const all = getAllMembers(pool);
    expect(all).toHaveLength(2);
    expect(all.find((m) => m.holderId === "mallory")?.active).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. Full Demo Flow (the headline)
// ═══════════════════════════════════════════════════════════════════════════

describe("full demo flow: issue → gate → revoke → eject", () => {
  it("runs the complete lifecycle correctly", () => {
    const state = createIssuanceState("0xissuer");
    const revState = createRevocationState();
    const pool = createPool(POOL_ID);

    // 1. Issue credentials.
    const aliceResult = processApplicant(state, ALICE, SECRETS.alice);
    const malloryResult = processApplicant(state, MALLORY, SECRETS.mallory);
    const carolResult = processApplicant(state, CAROL, SECRETS.carol);

    expect(aliceResult.verification.decision).toBe("approved");
    expect(malloryResult.verification.decision).toBe("approved");
    expect(carolResult.verification.decision).toBe("declined");

    // 2. Admit valid holders to the pool.
    for (const holderId of ["alice", "mallory"]) {
      const holder = state.holders.get(holderId)!;
      const applicant = holderId === "alice" ? ALICE : MALLORY;
      const v = verifyDocuments(applicant);
      const attrs = hashAttributes(v.extractedAttributes!);
      const idx = state.tree.indexOf(holder.commitment!.hash);
      const mProof = state.tree.generateProof(idx);
      const { proof, publicSignals } = generateProof({
        secret: holder.commitment!.secret,
        attributesHash: attrs,
        merkleProof: mProof,
        context: POOL_ID,
      });
      const result = admitToPool(pool, holderId, proof, publicSignals, getCurrentRoot(state), revState.revokedNullifiers);
      expect(result.admitted).toBe(true);
    }
    expect(getActiveCount(pool)).toBe(2);

    // 3. Autonomous revocation of mallory.
    revokeHolder(state, revState, "mallory", POOL_ID, {
      id: "headline-risk",
      holderId: "mallory",
      type: "sanctions_hit",
      description: "OFAC SDN sanctions list",
      detectedAt: new Date().toISOString(),
      autonomous: true,
    });

    expect(state.holders.get("mallory")?.status).toBe("revoked");

    // 4. Enforce pool — mallory ejected.
    const ejected = enforcePool(pool, getCurrentRoot(state), revState.revokedNullifiers);
    expect(ejected).toContain("mallory");
    expect(getActiveCount(pool)).toBe(1);

    // 5. Alice's proof still verifies.
    const aliceHolder = state.holders.get("alice")!;
    const aliceV = verifyDocuments(ALICE);
    const aliceAttrs = hashAttributes(aliceV.extractedAttributes!);
    const aliceIdx = state.tree.indexOf(aliceHolder.commitment!.hash);
    const aliceProof = state.tree.generateProof(aliceIdx);
    const { proof: aProof, publicSignals: aSig } = generateProof({
      secret: aliceHolder.commitment!.secret,
      attributesHash: aliceAttrs,
      merkleProof: aliceProof,
      context: POOL_ID,
    });
    const aliceResult2 = verifyProof({
      proof: aProof,
      publicSignals: aSig,
      currentRoot: getCurrentRoot(state),
      revokedNullifiers: revState.revokedNullifiers,
    });
    expect(aliceResult2.valid).toBe(true);

    // 6. PII scan — 0 fields.
    const contractState = JSON.stringify({
      merkle_root: getCurrentRoot(state),
      nullifiers: getRevokedNullifiers(revState),
      valid_count: state.tree.size,
    });
    expect(contractState).not.toContain("Alice");
    expect(contractState).not.toContain("Mallory");
    expect(contractState).not.toContain("passport");
    expect(contractState).not.toContain("TK782");
  });
});

describe("Additional Core Edge Cases", () => {
  it("generateIssuerKeypair generates valid key pair", () => {
    const keys = generateIssuerKeypair();
    expect(keys.publicKey).toMatch(/^0x[0-9a-f]{64}$/);
    expect(keys.secretKey).toHaveLength(64);
  });

  it("processAll processes applicants when secret is missing", () => {
    const state = createIssuanceState("0xissuer");
    const results = processAll(state, [ALICE], {});
    expect(results).toHaveLength(1);
    expect(results[0].commitment).toBeDefined();
  });

  it("MerkleTree full throws", () => {
    const tree = new MerkleTree(1);
    tree.insert("0x1");
    tree.insert("0x2");
    expect(() => tree.insert("0x3")).toThrow("Merkle tree full");
  });

  it("MerkleTree remove and generateProof throws on invalid index", () => {
    const tree = new MerkleTree(4);
    expect(() => tree.remove(-1)).toThrow("Invalid leaf index");
    expect(() => tree.remove(0)).toThrow("Invalid leaf index");
    expect(() => tree.generateProof(-1)).toThrow("Invalid leaf index");
    expect(() => tree.generateProof(0)).toThrow("Invalid leaf index");
  });

  it("zk generateProof throws when Merkle proof is invalid", () => {
    const tree = new MerkleTree(2);
    const leaf = generateCommitment("secret", "0x123");
    tree.insert(leaf);
    const proof = tree.generateProof(0);
    proof.root = "0xwrongroot";
    expect(() => generateProof({
      secret: "secret",
      attributesHash: "0x123",
      merkleProof: proof,
      context: "ctx",
    })).toThrow("Merkle proof is invalid");
  });

  it("zk verifyProof returns invalid for wrong protocol or missing components", () => {
    const validResult = verifyProof({
      proof: { protocol: "invalid" } as any,
      publicSignals: { root: "0x123", nullifierHash: "0x456", context: "ctx" },
      currentRoot: "0x123",
      revokedNullifiers: new Set(),
    });
    expect(validResult.valid).toBe(false);
    expect(validResult.reason).toContain("Invalid proof protocol");

    const malformedResult = verifyProof({
      proof: { protocol: "groth16" } as any,
      publicSignals: { root: "0x123", nullifierHash: "0x456", context: "ctx" },
      currentRoot: "0x123",
      revokedNullifiers: new Set(),
    });
    expect(malformedResult.valid).toBe(false);
    expect(malformedResult.reason).toContain("Malformed proof");
  });

  it("pool admitToPool fails to admit if proof verification fails", () => {
    const pool = createPool("p1");
    const result = admitToPool(pool, "alice", {} as any, {} as any, "0x123", new Set());
    expect(result.admitted).toBe(false);
    expect(result.reason).toContain("Invalid proof protocol");
  });

  it("pool getActiveMembers returns active members only", () => {
    const pool = createPool("p1");
    pool.members.set("alice", {
      holderId: "alice",
      proof: {} as any,
      publicSignals: {} as any,
      admittedAt: "",
      active: true,
    });
    pool.members.set("bob", {
      holderId: "bob",
      proof: {} as any,
      publicSignals: {} as any,
      admittedAt: "",
      active: false,
    });
    const active = getActiveMembers(pool);
    expect(active).toHaveLength(1);
    expect(active[0].holderId).toBe("alice");
  });

  it("revokeHolder throws for unknown holder or missing commitment", () => {
    const iState = createIssuanceState("0xissuer");
    const rState = createRevocationState();
    expect(() => revokeHolder(iState, rState, "nonexistent", "ctx", {} as any)).toThrow("Unknown holder");

    iState.holders.set("bob", {
      status: "valid",
      riskEvents: [],
    } as any);
    expect(() => revokeHolder(iState, rState, "bob", "ctx", {} as any)).toThrow("has no commitment to revoke");
  });

  it("verifyAll batch verifies applicants", () => {
    const results = verifyAll([ALICE]);
    expect(results).toHaveLength(1);
    expect(results[0].decision).toBe("approved");
  });

  it("monitorPass runs and triggers callbacks on risk events", async () => {
    const feed: RiskFeed = {
      entries: [
        { holderId: "alice", addedAt: new Date().toISOString(), reason: "Sanctioned" }
      ]
    };
    const onRevoke = vi.fn().mockResolvedValue("0xrevokedeployhash");
    const events = await monitorPass({
      holderIds: ["alice", "bob"],
      feed,
      onRevoke,
    });

    expect(events).toHaveLength(1);
    expect(events[0].holderId).toBe("alice");
    expect(events[0].deployHash).toBe("0xrevokedeployhash");
    expect(onRevoke).toHaveBeenCalledTimes(1);
  });

  it("createMonitorAgent manages monitor agent lifecycle", async () => {
    const feed: RiskFeed = {
      entries: [
        { holderId: "alice", addedAt: new Date().toISOString(), reason: "Sanctioned" }
      ]
    };
    const onRevoke = vi.fn().mockResolvedValue("0xdeploy");
    const agent = createMonitorAgent({
      holderIds: ["alice"],
      feed,
      onRevoke,
    });

    expect(agent.running).toBe(false);
    expect(agent.getProcessedEvents()).toHaveLength(0);

    const promise = agent.start();
    expect(agent.running).toBe(true);
    await expect(agent.start()).rejects.toThrow("Monitor is already running");

    const events = await promise;
    expect(agent.running).toBe(false);
    expect(events).toHaveLength(1);
    expect(agent.getProcessedEvents()).toHaveLength(1);

    const newFeed: RiskFeed = {
      entries: [
        { holderId: "bob", addedAt: new Date().toISOString(), reason: "Sanctioned" }
      ]
    };
    agent.updateFeed(newFeed);
  });
});

describe("Additional Core Edge Cases Part 2", () => {
  it("MerkleTree buildLayers sparse array fallbacks", () => {
    const tree = new MerkleTree(2);
    (tree as any).leaves = [,];
    expect(() => tree.insert("0x1")).not.toThrow();
  });

  it("pool ejectFromPool and enforcePool edge cases", () => {
    const pool = createPool("p1");
    // eject nonexistent
    expect(ejectFromPool(pool, "nonexistent", "reason")).toBe(false);

    // eject active
    pool.members.set("alice", {
      holderId: "alice",
      proof: {} as any,
      publicSignals: { nullifierHash: "0x123" } as any,
      admittedAt: "",
      active: true,
    });
    expect(ejectFromPool(pool, "alice", "reason")).toBe(true);
    // eject already inactive
    expect(ejectFromPool(pool, "alice", "reason")).toBe(false);

    // enforcePool with inactive member
    pool.members.set("bob", {
      holderId: "bob",
      proof: {} as any,
      publicSignals: { nullifierHash: "0x456" } as any,
      admittedAt: "",
      active: false,
    });
    const ejected = enforcePool(pool, "0xroot", new Set(["0x456"]));
    expect(ejected).toHaveLength(0);
  });

  it("revokeHolder when commitment is not in the Merkle tree", () => {
    const iState = createIssuanceState("0xissuer");
    const rState = createRevocationState();
    iState.holders.set("bob", {
      status: "valid",
      commitment: { hash: "0xnotintree", secret: "secret", attributesHash: "0x123" },
      riskEvents: [],
      deployHashes: { issuance: "mock-issuance" },
    } as any);
    const result = revokeHolder(iState, rState, "bob", "ctx", {} as any);
    expect(result.newRoot).toBeDefined();
  });

  it("verifyDocuments field missing edge cases", () => {
    const app1: Applicant = {
      id: "app1",
      documents: {
        fullName: "Name",
        nationality: "",
        documentType: "passport",
        documentNumber: "123",
        expiryDate: "2029-01-01",
        isAuthentic: true,
      },
      expectedOutcome: "declined",
    };
    const res1 = verifyDocuments(app1);
    expect(res1.decision).toBe("declined");
    expect(res1.reason).toContain("Missing nationality");

    const app2: Applicant = {
      id: "app2",
      documents: {
        fullName: "Name",
        nationality: "US",
        documentType: "passport",
        documentNumber: "",
        expiryDate: "2029-01-01",
        isAuthentic: true,
      },
      expectedOutcome: "declined",
    };
    const res2 = verifyDocuments(app2);
    expect(res2.decision).toBe("declined");
    expect(res2.reason).toContain("Missing document number");
  });

  it("MerkleTree root null fallback branch", () => {
    const tree = new MerkleTree(2);
    (tree as any).layers[tree.depth] = [null];
    expect(tree.root).toBe((tree as any).zeroHashes[tree.depth]);
  });

  it("MerkleTree root undefined fallback branch", () => {
    const tree = new MerkleTree(2);
    (tree as any).layers[tree.depth] = [];
    expect(tree.root).toBe((tree as any).zeroHashes[tree.depth]);
  });

  it("MerkleTree buildLayers null/undefined elements fallback", () => {
    const tree = new MerkleTree(2);
    (tree as any).leaves = [null, undefined];
    const layers = (tree as any).buildLayers();
    const zeroForLevel = (tree as any).zeroHashes[0];
    const expectedParent = poseidonHash(zeroForLevel, zeroForLevel);
    expect(layers[1][0]).toBe(expectedParent);
  });
});

