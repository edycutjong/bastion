// POST /check — x402-gated proof verification → boolean.
// In production: 402 → consumer signs EIP-712 CEP-18 payment → CSPR.cloud facilitator
// verify+settle → server verifies the Groth16 proof → 200 { compliant: true|false }.
// Issuance/revocation/proving never touch x402.

import { NextResponse } from "next/server";
import { verifyProof } from "@/core/zk";
import type { PublicSignals, ZkProof } from "@/core/types";
import {
  x402LiveConfigured,
  buildPaymentRequirements,
  verifyAndSettle,
  type PaymentPayload,
} from "@/core/x402_facilitator";

const CHECK_PRICE = process.env.X402_CHECK_PRICE ?? "$0.001";

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      proof: ZkProof;
      publicSignals: PublicSignals;
      currentRoot: string;
      revokedNullifiers: string[];
    };

    if (!body.proof || !body.publicSignals) {
      return NextResponse.json(
        { error: "Missing proof or publicSignals." },
        { status: 400 },
      );
    }

    // In production, the server reads currentRoot and revokedNullifiers from the on-chain contract.
    // For the demo, the client passes them (or the server uses in-memory state).
    const result = verifyProof({
      proof: body.proof,
      publicSignals: body.publicSignals,
      currentRoot: body.currentRoot ?? "",
      revokedNullifiers: new Set(body.revokedNullifiers ?? []),
    });

    // Live x402: settle the consumer's payment through the facilitator → real tx hash.
    if (result.valid && x402LiveConfigured()) {
      let payload: PaymentPayload;
      try {
        payload = JSON.parse(Buffer.from(request.headers.get("x-payment") ?? "", "base64").toString("utf8"));
      } catch {
        return NextResponse.json(
          { error: "Payment required", accepts: [buildPaymentRequirements(CHECK_PRICE, "/api/check")] },
          { status: 402 },
        );
      }
      const settle = await verifyAndSettle(payload, buildPaymentRequirements(CHECK_PRICE, "/api/check"));
      if (!settle.success) {
        return NextResponse.json({ error: settle.errorReason ?? "payment rejected" }, { status: 402 });
      }
      return NextResponse.json({
        compliant: true,
        settlementHash: settle.txHash,
        explorerUrl: settle.txHash ? `https://testnet.cspr.live/transaction/${settle.txHash}` : undefined,
        mode: "live",
      });
    }

    // Demo (default): simulated x402 settlement hash.
    const settlementHash = result.valid
      ? `0x${Buffer.from(`x402-settle-${Date.now()}`).toString("hex").slice(0, 64).padEnd(64, "0")}`
      : undefined;

    return NextResponse.json({
      compliant: result.valid,
      reason: result.reason,
      settlementHash,
      mode: "demo",
    });
  } catch (_err) {
    return NextResponse.json({ error: "Internal check error." }, { status: 500 });
  }
}
