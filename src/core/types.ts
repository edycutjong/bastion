// Bastion domain model — shared by the core modules, API routes, and the UI.
// Mirrors the on-chain Bastion contract (see contract/src/bastion.rs).

// ── Credential Status ──────────────────────────────────────────────────────

export type CredentialStatus = "valid" | "revoked" | "expired" | "declined";

// ── Applicant & Documents ──────────────────────────────────────────────────

export interface ApplicantDocuments {
  /** Synthetic document bundle (no real PII). */
  fullName: string;
  nationality: string;
  documentType: "passport" | "national_id" | "drivers_license";
  documentNumber: string;
  /** ISO 8601 date string. */
  expiryDate: string;
  /** Whether the document is valid (for mock verifier logic). */
  isAuthentic: boolean;
}

export interface Applicant {
  id: string;
  documents: ApplicantDocuments;
  /** Expected outcome for the deterministic demo. */
  expectedOutcome: CredentialStatus;
}

// ── Cryptographic Primitives ───────────────────────────────────────────────

/** A Poseidon hash output (hex string). */
export type PoseidonHash = string;

/** A Poseidon commitment = H(secret, attributesHash). */
export interface Commitment {
  /** Hex-encoded commitment hash. */
  hash: PoseidonHash;
  /** The holder's secret (hex, off-chain only). */
  secret: string;
  /** Hash of the holder's verified attributes. */
  attributesHash: PoseidonHash;
}

/** Nullifier = H(secret, context). Used for double-use prevention + revocation. */
export interface Nullifier {
  hash: PoseidonHash;
  /** Context binding (e.g., pool id). */
  context: string;
}

// ── Merkle Tree ────────────────────────────────────────────────────────────

export interface MerkleProof {
  /** The leaf being proved. */
  leaf: PoseidonHash;
  /** Merkle root the proof is against. */
  root: PoseidonHash;
  /** Path indices (0 = left, 1 = right) from leaf to root. */
  pathIndices: number[];
  /** Sibling hashes along the path. */
  siblings: PoseidonHash[];
}

// ── ZK Proof (Groth16 shape) ───────────────────────────────────────────────

export interface ZkProof {
  /** Proof type identifier. */
  protocol: "groth16";
  /** Proof components (pi_a, pi_b, pi_c in real Groth16). */
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
}

export interface PublicSignals {
  /** Merkle root the proof was generated against. */
  root: PoseidonHash;
  /** Nullifier hash (for double-use prevention + revocation check). */
  nullifierHash: PoseidonHash;
  /** Context binding (e.g., pool id). */
  context: string;
}

export interface ProofVerificationResult {
  valid: boolean;
  /** Why the proof is invalid (if applicable). */
  reason?: string;
}

// ── EIP-712 Credential ─────────────────────────────────────────────────────

export interface Eip712Credential {
  /** The holder's public key / account hash. */
  holder: string;
  /** Hash of the verified attributes. */
  attributesHash: PoseidonHash;
  /** ISO 8601 issuance timestamp. */
  issuedAt: string;
  /** ISO 8601 expiry timestamp. */
  expiresAt: string;
  /** EIP-712 typed-data signature (hex). */
  signature: string;
  /** Issuer public key. */
  issuer: string;
}

// ── Risk & Monitoring ──────────────────────────────────────────────────────

export type RiskEventType = "sanctions_hit" | "anomalous_activity" | "manual_revoke";

export interface RiskEvent {
  id: string;
  holderId: string;
  type: RiskEventType;
  description: string;
  /** ISO 8601 timestamp. */
  detectedAt: string;
  /** Whether the revocation was executed autonomously (vs. manual). */
  autonomous: boolean;
  /** Deploy hash of the revocation tx (filled after broadcast). */
  deployHash?: string;
}

// ── Gated Pool ─────────────────────────────────────────────────────────────

export interface PoolMember {
  holderId: string;
  /** The ZK proof that admitted them. */
  proof: ZkProof;
  publicSignals: PublicSignals;
  /** ISO 8601 admission timestamp. */
  admittedAt: string;
  /** Whether the member is still in the pool. */
  active: boolean;
  /** ISO 8601 ejection timestamp (if ejected). */
  ejectedAt?: string;
  /** Reason for ejection. */
  ejectionReason?: string;
}

// ── x402 Check ─────────────────────────────────────────────────────────────

export interface X402CheckRequest {
  proof: ZkProof;
  publicSignals: PublicSignals;
}

export interface X402CheckResponse {
  compliant: boolean;
  /** Settlement deploy hash (CEP-18 payment). */
  settlementHash?: string;
}

// ── Holder State (the full per-holder view) ────────────────────────────────

export interface HolderState {
  id: string;
  status: CredentialStatus;
  credential?: Eip712Credential;
  commitment?: Commitment;
  nullifier?: Nullifier;
  /** Last ZK proof verification result. */
  lastProofResult?: ProofVerificationResult;
  /** Pool membership status. */
  inPool: boolean;
  /** Risk events that affected this holder. */
  riskEvents: RiskEvent[];
  /** Deploy hashes for on-chain transactions. */
  deployHashes: {
    commitmentInsert?: string;
    revocation?: string;
  };
}

// ── Demo Timeline ──────────────────────────────────────────────────────────

export interface DemoStep {
  label: string;
  description: string;
  /** ISO 8601 timestamp of when this step fires. */
  timestamp: string;
  /** Which holder(s) are affected. */
  affectedHolders: string[];
  /** Expected state after this step. */
  expectedStates: Record<string, CredentialStatus>;
}
