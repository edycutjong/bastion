// POST /api/verify — User submits docs (off-chain), agent decides.
// Returns the verification result (approve / decline) without leaking PII.

import { NextResponse } from "next/server";
import { verifyDocuments } from "@/core/verify";
import type { Applicant } from "@/core/types";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { applicant: Applicant };

    if (!body.applicant?.id || !body.applicant?.documents) {
      return NextResponse.json(
        { error: "Missing applicant data (id + documents required)." },
        { status: 400 },
      );
    }

    const result = verifyDocuments(body.applicant);

    return NextResponse.json({
      applicantId: result.applicantId,
      decision: result.decision,
      reason: result.reason,
      // extractedAttributes are returned only on approval (non-PII derivatives).
      extractedAttributes: result.extractedAttributes,
    });
  } catch (_err) {
    return NextResponse.json({ error: "Internal verification error." }, { status: 500 });
  }
}
