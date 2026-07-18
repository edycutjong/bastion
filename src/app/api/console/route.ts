// Compliance console orchestration endpoint.
//   GET  /api/console                  → initial snapshot (nothing revoked)
//   POST /api/console { revoke: [...] } → snapshot after replaying revocations
//
// Stateless: the client carries the revoked-holder list (the on-chain nullifier set),
// so the demo survives serverless cold starts and is fully reproducible.

import { NextResponse } from "next/server";
import { buildSnapshot } from "@/lib/compliance";
import { reviewRevocations } from "@/core/llm";

export async function GET() {
  return NextResponse.json(buildSnapshot([]));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { revoke?: unknown };
    const revoke = Array.isArray(body.revoke)
      ? body.revoke.filter((x): x is string => typeof x === "string")
      : [];
    const snapshot = buildSnapshot(revoke);
    // Real Claude compliance officer over the completed revocations (null when
    // keyless or nothing revoked). Decisions and crypto in the snapshot are
    // deterministic either way — the LLM only writes the file memos and attests
    // that its inputs contained zero PII.
    const officerReview = await reviewRevocations(snapshot);
    return NextResponse.json({ ...snapshot, officerReview });
  } catch {
    return NextResponse.json({ error: "Failed to build compliance snapshot." }, { status: 500 });
  }
}
