// POST /internal/revoke — Monitor/admin revoke (update root / nullifier).
// This is called by the monitor agent when a risk event triggers autonomous revocation.

import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      holderId: string;
      nullifierHash: string;
      commitmentHash: string;
      reasonCode: number;
      newRoot: string;
    };

    if (!body.holderId || !body.nullifierHash) {
      return NextResponse.json(
        { error: "Missing holderId or nullifierHash." },
        { status: 400 },
      );
    }

    // Live mode: broadcast a real revoke TransactionV1 via casper-js-sdk (PEM key).
    if (process.env.BASTION_DEMO === "false") {
      const { revokeOnChain } = await import("@/lib/casper");
      const { deployHash, explorerUrl } = await revokeOnChain({
        nullifier: body.nullifierHash,
        commitment: body.commitmentHash ?? "",
        reasonCode: body.reasonCode ?? 1,
        newRoot: body.newRoot ?? "",
      });
      return NextResponse.json({
        holderId: body.holderId,
        status: "revoked",
        nullifierHash: body.nullifierHash,
        deployHash,
        explorerUrl,
        mode: "live",
        message: `Autonomous revocation broadcast on-chain for ${body.holderId}.`,
      });
    }

    // Demo mode (default): deterministic mock deploy hash, no chain write.
    const deployHash = `0x${Buffer.from(`revoke-${body.holderId}-${Date.now()}`).toString("hex").slice(0, 64).padEnd(64, "0")}`;

    return NextResponse.json({
      holderId: body.holderId,
      status: "revoked",
      nullifierHash: body.nullifierHash,
      deployHash,
      mode: "demo",
      message: `Autonomous revocation executed for ${body.holderId}.`,
    });
  } catch (_err) {
    return NextResponse.json({ error: "Internal revocation error." }, { status: 500 });
  }
}
