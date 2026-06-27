// POST /api/prove — Generate a ZK proof (server-side for demo).
// In production, this runs in the browser/worker (secret never leaves the device).

import { NextResponse } from "next/server";
import { generateProof } from "@/core/zk";
import type { MerkleProof, PoseidonHash } from "@/core/types";

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      secret: string;
      attributesHash: PoseidonHash;
      merkleProof: MerkleProof;
      context: string;
    };

    if (!body.secret || !body.attributesHash || !body.merkleProof || !body.context) {
      return NextResponse.json(
        { error: "Missing secret, attributesHash, merkleProof, or context." },
        { status: 400 },
      );
    }

    const { proof, publicSignals } = generateProof({
      secret: body.secret,
      attributesHash: body.attributesHash,
      merkleProof: body.merkleProof,
      context: body.context,
    });

    return NextResponse.json({ proof, publicSignals });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Proof generation failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
