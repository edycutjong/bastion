// Verifier agent — takes applicant documents (mock), runs verification logic,
// returns approve/decline decision. Simulates LLM-assisted document check.
// In production, integrates with a real KYC vendor or document OCR service.

import type { Applicant, ApplicantDocuments, CredentialStatus } from "./types";

export interface VerificationResult {
  applicantId: string;
  decision: "approved" | "declined";
  /** Why the decision was made. */
  reason: string;
  /** Attributes extracted from the documents (hashed for the commitment). */
  extractedAttributes?: Record<string, string>;
}

/**
 * Verify an applicant's documents.
 * The mock verifier checks:
 * 1. Document authenticity flag (simulating OCR/vendor verification).
 * 2. Document expiry date (must be in the future).
 * 3. Required fields present.
 *
 * In production: LLM-assisted document analysis + real KYC vendor API call.
 */
export function verifyDocuments(applicant: Applicant): VerificationResult {
  const docs = applicant.documents;
  const failures: string[] = [];

  // Check authenticity (mock: uses the seeded flag).
  if (!docs.isAuthentic) {
    failures.push("Document failed authenticity verification.");
  }

  // Check expiry.
  if (new Date(docs.expiryDate) < new Date()) {
    failures.push("Document has expired.");
  }

  // Check required fields.
  if (!docs.fullName?.trim()) failures.push("Missing full name.");
  if (!docs.nationality?.trim()) failures.push("Missing nationality.");
  if (!docs.documentNumber?.trim()) failures.push("Missing document number.");

  if (failures.length > 0) {
    return {
      applicantId: applicant.id,
      decision: "declined",
      reason: failures.join(" "),
    };
  }

  return {
    applicantId: applicant.id,
    decision: "approved",
    reason: "All verification checks passed.",
    extractedAttributes: extractAttributes(docs),
  };
}

/**
 * Extract attributes from verified documents for the credential commitment.
 * Only non-PII derivative attributes are used (nationality, document type, expiry year).
 * The raw PII stays off-chain (encrypted vault or discarded).
 */
function extractAttributes(docs: ApplicantDocuments): Record<string, string> {
  return {
    nationality: docs.nationality,
    documentType: docs.documentType,
    expiryYear: new Date(docs.expiryDate).getFullYear().toString(),
    verifiedAt: new Date().toISOString().slice(0, 10), // date only, no time
  };
}

/**
 * Batch-verify all applicants (used by the seed script).
 */
export function verifyAll(applicants: Applicant[]): VerificationResult[] {
  return applicants.map(verifyDocuments);
}

/**
 * Map a verification decision to a credential status.
 */
export function decisionToStatus(decision: VerificationResult["decision"]): CredentialStatus {
  return decision === "approved" ? "valid" : "declined";
}
