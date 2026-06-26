// GET /api/pool — Gated demo pool membership.
// Returns the current pool state (active members, ejected members).

import { NextResponse } from "next/server";
import { loadApplicants } from "@/lib/fixtures";

export async function GET() {
  const applicants = loadApplicants();

  // Build the pool state from fixtures (deterministic).
  const members = applicants.map((a) => ({
    holderId: a.id,
    status: a.expectedOutcome,
    active: a.expectedOutcome === "valid",
    admittedAt: a.expectedOutcome === "valid" ? new Date().toISOString() : null,
    ejectedAt: null,
  }));

  return NextResponse.json({
    poolId: "bastion-rwa-pool-1",
    activeCount: members.filter((m) => m.active).length,
    totalMembers: members.length,
    members,
  });
}
