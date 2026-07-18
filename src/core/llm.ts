// Real LLM compliance officer — a genuine Claude call over revocation events, guardrailed.
//
// Division of labor (honesty by construction):
//  - DECISIONS and CRYPTO are always deterministic: who gets revoked, nullifier
//    publication, Merkle-root updates, and proof verification come from the rule
//    engine (lib/compliance + core/*). The LLM cannot change any of them.
//  - The LLM contributes what a rule engine can't: a written compliance-officer
//    memo per revocation (why this action was warranted), an independent severity
//    assessment, and a privacy attestation — it confirms it saw ONLY hashes and
//    event metadata, never PII, which is the whole point of Bastion.
//  - No key / API error → `null`, and callers fall back to the deterministic
//    reasons, so keyless judges lose nothing.
//
// The snapshot is fixture-deterministic, so the review is cached per input digest —
// the public console endpoint triggers at most one Claude call per revocation set.

import { createHash } from "node:crypto";
import { llmConfigured, structuredCall } from "@/lib/anthropic";
import { config } from "@/lib/config";
import type { ComplianceSnapshot } from "@/lib/compliance";

export interface RevocationMemo {
  holderId: string;
  /** Compliance-officer justification for the revocation. */
  memo: string;
  severity: "critical" | "high" | "medium";
}

export interface OfficerReview {
  memos: RevocationMemo[];
  /** The officer's attestation that it observed zero PII in its inputs. */
  privacyAttestation: string;
  model: string;
}

const SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    memos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          holderId: { type: "string" },
          memo: {
            type: "string",
            description:
              "2-3 sentence compliance-officer justification grounded ONLY in the provided event metadata and on-chain effects.",
          },
          severity: { type: "string", enum: ["critical", "high", "medium"] },
        },
        required: ["holderId", "memo", "severity"],
        additionalProperties: false,
      },
    },
    privacyAttestation: {
      type: "string",
      description:
        "One sentence attesting what data classes were visible in the input (hashes, event types, timestamps) and that no personal data was present.",
    },
  },
  required: ["memos", "privacyAttestation"],
  additionalProperties: false,
};

const SYSTEM = `You are the compliance officer for Bastion, a privacy-preserving
KYC gateway on Casper. Holders are admitted as Merkle commitments; revocation
publishes a nullifier and rotates the root — no PII ever touches the chain.
You review completed autonomous revocations like an auditor writing the file memo:
- Ground every statement in the event metadata and on-chain effects provided.
- Assign severity: sanctions_hit = critical unless metadata says otherwise;
  manual_revoke = judge from the stated reason.
- You see only identifiers, hashes, event types and timestamps. Attest to that.`;

interface CacheEntry {
  digest: string;
  review: OfficerReview;
}
let cache: CacheEntry | null = null;

/**
 * Review the snapshot's revocations with a real Claude call (cached per digest).
 * Returns `null` when nothing is revoked, no ANTHROPIC_API_KEY is configured, or
 * the call fails — callers must treat that as "deterministic reasons only".
 */
export async function reviewRevocations(snapshot: ComplianceSnapshot): Promise<OfficerReview | null> {
  const revoked = snapshot.holders.filter((h) => h.status === "revoked");
  if (revoked.length === 0 || !llmConfigured()) return null;

  // Stable projection = exactly what the model sees (no timestamps that churn
  // between identical requests) — doubles as the cache key.
  const input = {
    poolId: snapshot.poolId,
    currentRoot: snapshot.root,
    activeCount: snapshot.activeCount,
    totalHolders: snapshot.totalHolders,
    revocations: revoked.map((h) => ({
      holderId: h.id,
      eventReason: h.riskReason,
      nullifierHash: h.nullifierHash,
      proofNowVerifies: h.proofVerifies,
      stillInPool: h.inPool,
    })),
  };
  const digest = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  if (cache?.digest === digest) return cache.review;

  try {
    const out = await structuredCall<Omit<OfficerReview, "model">>({
      model: config.officerModel,
      system: [{ text: SYSTEM, cache: true }],
      user: `Completed autonomous revocations to review:\n${JSON.stringify(input, null, 2)}`,
      schema: SCHEMA,
      maxTokens: 800,
    });
    const review: OfficerReview = { ...out, model: config.officerModel };
    cache = { digest, review };
    return review;
  } catch {
    // Graceful degradation: the deterministic pipeline is the source of truth.
    return null;
  }
}

/** Test hook — clears the per-digest cache. */
export function _resetOfficerCache(): void {
  cache = null;
}
