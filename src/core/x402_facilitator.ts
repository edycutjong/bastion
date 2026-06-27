// Real Casper x402 facilitator client (CSPR.cloud) — Bastion pay-to-check.
// Server-only. Reached only when BASTION_DEMO === "false" and the facilitator
// env is configured; otherwise /api/check returns a simulated settlement hash.
//
// Verified surface (docs.cspr.cloud/x402-facilitator-api/reference):
//   Base: https://x402-facilitator.cspr.cloud
//   GET /supported · POST /verify · POST /settle · Authorization: $CSPR_CLOUD_API_KEY
//   Scheme "exact", CEP-18 asset, EIP-712 authorization.
// Bodies follow the x402 standard envelope { x402Version, paymentPayload,
// paymentRequirements }; confirm field names against make-software/casper-x402.

import { config } from "@/lib/config";

export interface PaymentRequirements {
  scheme: "exact";
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
}

export interface PaymentPayload {
  x402Version: number;
  scheme: "exact";
  network: string;
  payload: Record<string, unknown>;
}

export interface SettleResult {
  success: boolean;
  txHash?: string;
  network?: string;
  errorReason?: string;
}

export function x402LiveConfigured(): boolean {
  return (
    process.env.BASTION_DEMO === "false" &&
    !!config.x402FacilitatorUrl &&
    !!config.csprCloudKey &&
    !!config.x402AssetPackage &&
    !!config.x402PayeeAddress
  );
}

export function buildPaymentRequirements(price: string, resource: string): PaymentRequirements {
  return {
    scheme: "exact",
    network: config.x402ChainId,
    maxAmountRequired: price,
    resource,
    description: `Bastion compliance check (${resource})`,
    asset: config.x402AssetPackage.replace(/^hash-/, ""),
    payTo: config.x402PayeeAddress,
    maxTimeoutSeconds: 60,
  };
}

async function facilitatorPost<T>(path: "/verify" | "/settle", body: unknown): Promise<T> {
  const res = await fetch(`${config.x402FacilitatorUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: config.csprCloudKey },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`x402 facilitator ${path} → ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

/** Full verify → settle. Returns the on-chain settlement hash on success. */
export async function verifyAndSettle(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
): Promise<SettleResult> {
  const verify = await facilitatorPost<{ isValid: boolean; invalidReason?: string }>("/verify", {
    x402Version: paymentPayload.x402Version,
    paymentPayload,
    paymentRequirements,
  });
  if (!verify.isValid) {
    return { success: false, errorReason: verify.invalidReason ?? "verification failed" };
  }
  return facilitatorPost<SettleResult>("/settle", {
    x402Version: paymentPayload.x402Version,
    paymentPayload,
    paymentRequirements,
  });
}
