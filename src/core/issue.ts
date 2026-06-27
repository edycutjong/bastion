// Issuance pipeline — combines credential attestation + commitment insertion.
// Issues an EIP-712 credential → generates a Poseidon commitment →
// inserts into the Merkle tree → (stub) writes to on-chain contract via casper-js-sdk (PEM key).

import { issueCredential } from "./attest";
import { MerkleTree } from "./merkle";
import { generateCommitment, hashAttributes } from "./poseidon";
import type { Commitment, Eip712Credential, HolderState, PoseidonHash } from "./types";
import { verifyDocuments, type VerificationResult } from "./verify";
import type { Applicant } from "./types";

// ── Issuance State ─────────────────────────────────────────────────────────

export interface IssuanceState {
  /** The Merkle tree of valid commitments. */
  tree: MerkleTree;
  /** All holder states indexed by holder ID. */
  holders: Map<string, HolderState>;
  /** Issuer public key. */
  issuerPublicKey: string;
}

export function createIssuanceState(issuerPublicKey: string): IssuanceState {
  return {
    tree: new MerkleTree(20),
    holders: new Map(),
    issuerPublicKey,
  };
}

// ── Full Issuance Flow ─────────────────────────────────────────────────────

export interface IssuanceResult {
  holderId: string;
  verification: VerificationResult;
  credential?: Eip712Credential;
  commitment?: Commitment;
  leafIndex?: number;
  deployHash?: string;
}

/**
 * Run the full issuance pipeline for an applicant:
 * 1. Verify documents (off-chain).
 * 2. If approved: issue EIP-712 credential + insert Poseidon commitment.
 * 3. If declined: record status, no on-chain action.
 */
export function processApplicant(
  state: IssuanceState,
  applicant: Applicant,
  secret: string,
): IssuanceResult {
  // 1. Verify documents.
  const verification = verifyDocuments(applicant);

  // Initialize holder state.
  const holderState: HolderState = {
    id: applicant.id,
    status: "declined",
    inPool: false,
    riskEvents: [],
    deployHashes: {},
  };

  if (verification.decision === "declined") {
    state.holders.set(applicant.id, holderState);
    return { holderId: applicant.id, verification };
  }

  // 2. Issue credential.
  const attributesHash = hashAttributes(verification.extractedAttributes!);
  const credential = issueCredential({
    holder: applicant.id,
    attributesHash,
    issuer: state.issuerPublicKey,
  });

  // 3. Generate Poseidon commitment and insert into Merkle tree.
  const commitmentHash = generateCommitment(secret, attributesHash);
  const leafIndex = state.tree.insert(commitmentHash);
  const commitment: Commitment = { hash: commitmentHash, secret, attributesHash };

  // 4. Update holder state.
  holderState.status = "valid";
  holderState.credential = credential;
  holderState.commitment = commitment;

  // In production: casper-js-sdk `insert_commitment(commitmentHash, credential.signature)`
  //   const keyPair = Keys.Ed25519.loadKeyPairFromPrivateFile(config.orchestratorKeyPath);
  //   Build TransactionV1, sign with keyPair, broadcast → real Testnet deploy hash.
  const mockDeployHash = `0x${Buffer.from(`insert-${applicant.id}-${Date.now()}`).toString("hex").slice(0, 64).padEnd(64, "0")}`;
  holderState.deployHashes.commitmentInsert = mockDeployHash;

  state.holders.set(applicant.id, holderState);

  return {
    holderId: applicant.id,
    verification,
    credential,
    commitment,
    leafIndex,
    deployHash: mockDeployHash,
  };
}

/**
 * Process all applicants in batch (used by the seed script).
 */
export function processAll(
  state: IssuanceState,
  applicants: Applicant[],
  secrets: Record<string, string>,
): IssuanceResult[] {
  return applicants.map((a) => processApplicant(state, a, secrets[a.id] ?? ""));
}

/**
 * Get the current on-chain Merkle root (from the issuance state).
 */
export function getCurrentRoot(state: IssuanceState): PoseidonHash {
  return state.tree.root;
}
