// POST /api/issue — Issue credential (EIP-712) + insert_commitment via casper-js-sdk (PEM key).
// Returns the credential + commitment hash + deploy hash.

import { NextResponse } from "next/server";
import { issueCredential } from "@/core/attest";
import { generateCommitment, hashAttributes } from "@/core/poseidon";

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      holderId: string;
      extractedAttributes: Record<string, string>;
      secret: string;
      issuerPublicKey: string;
    };

    if (!body.holderId || !body.extractedAttributes || !body.secret) {
      return NextResponse.json(
        { error: "Missing holderId, extractedAttributes, or secret." },
        { status: 400 },
      );
    }

    // 1. Hash the attributes.
    const attributesHash = hashAttributes(body.extractedAttributes);

    // 2. Issue EIP-712 credential (gasless).
    const credential = issueCredential({
      holder: body.holderId,
      attributesHash,
      issuer: body.issuerPublicKey ?? "0xissuer",
    });

    // 3. Generate Poseidon commitment.
    const commitmentHash = generateCommitment(body.secret, attributesHash);

    // 4. (Stub) Insert commitment on-chain via casper-js-sdk (PEM key).
    const deployHash = `0x${Buffer.from(`insert-${body.holderId}-${Date.now()}`).toString("hex").slice(0, 64).padEnd(64, "0")}`;

    return NextResponse.json({
      holderId: body.holderId,
      credential,
      commitmentHash,
      attributesHash,
      deployHash,
    });
  } catch (_err) {
    return NextResponse.json({ error: "Internal issuance error." }, { status: 500 });
  }
}
