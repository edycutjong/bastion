import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  x402LiveConfigured,
  buildPaymentRequirements,
  verifyAndSettle,
  type PaymentPayload,
  type PaymentRequirements,
} from "./x402_facilitator";
import { config } from "@/lib/config";

describe("x402_facilitator", () => {
  const originalDemo = process.env.BASTION_DEMO;
  const originalFacilitator = config.x402FacilitatorUrl;
  const originalCloudKey = config.csprCloudKey;
  const originalAsset = config.x402AssetPackage;
  const originalPayee = config.x402PayeeAddress;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.BASTION_DEMO = originalDemo;
    (config as any).x402FacilitatorUrl = originalFacilitator;
    (config as any).csprCloudKey = originalCloudKey;
    (config as any).x402AssetPackage = originalAsset;
    (config as any).x402PayeeAddress = originalPayee;
  });

  it("checks if live configured", () => {
    process.env.BASTION_DEMO = "false";
    (config as any).x402FacilitatorUrl = "https://fac.cspr.cloud";
    (config as any).csprCloudKey = "test-key";
    (config as any).x402AssetPackage = "hash-123";
    (config as any).x402PayeeAddress = "0xpayee";

    expect(x402LiveConfigured()).toBe(true);

    process.env.BASTION_DEMO = "true";
    expect(x402LiveConfigured()).toBe(false);
  });

  it("builds payment requirements", () => {
    (config as any).x402ChainId = "casper:casper-test";
    (config as any).x402AssetPackage = "hash-token";
    (config as any).x402PayeeAddress = "0xpayee";

    const req = buildPaymentRequirements("100", "res1");
    expect(req.scheme).toBe("exact");
    expect(req.network).toBe("casper:casper-test");
    expect(req.maxAmountRequired).toBe("100");
    expect(req.resource).toBe("res1");
    expect(req.asset).toBe("token");
    expect(req.payTo).toBe("0xpayee");
  });

  it("verifies and settles payments successfully", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (url.toString().endsWith("/verify")) {
        return {
          ok: true,
          json: async () => ({ isValid: true }),
        } as Response;
      }
      if (url.toString().endsWith("/settle")) {
        return {
          ok: true,
          json: async () => ({ success: true, txHash: "0xsettletxhash" }),
        } as Response;
      }
      return { ok: false } as Response;
    });

    try {
      const payload: PaymentPayload = {
        x402Version: 1,
        scheme: "exact",
        network: "casper",
        payload: {},
      };
      const req: PaymentRequirements = buildPaymentRequirements("100", "res1");

      const result = await verifyAndSettle(payload, req);
      expect(result.success).toBe(true);
      expect(result.txHash).toBe("0xsettletxhash");
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("returns invalid details if verification fails", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (url.toString().endsWith("/verify")) {
        return {
          ok: true,
          json: async () => ({ isValid: false, invalidReason: "insufficient funds" }),
        } as Response;
      }
      return { ok: false } as Response;
    });

    try {
      const payload: PaymentPayload = {
        x402Version: 1,
        scheme: "exact",
        network: "casper",
        payload: {},
      };
      const req: PaymentRequirements = buildPaymentRequirements("100", "res1");

      const result = await verifyAndSettle(payload, req);
      expect(result.success).toBe(false);
      expect(result.errorReason).toBe("insufficient funds");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("handles empty errorReason string when verification fails", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (url.toString().endsWith("/verify")) {
        return {
          ok: true,
          json: async () => ({ isValid: false }),
        } as Response;
      }
      return { ok: false } as Response;
    });

    try {
      const payload: PaymentPayload = {
        x402Version: 1,
        scheme: "exact",
        network: "casper",
        payload: {},
      };
      const req: PaymentRequirements = buildPaymentRequirements("100", "res1");

      const result = await verifyAndSettle(payload, req);
      expect(result.success).toBe(false);
      expect(result.errorReason).toBe("verification failed");
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("throws error when fetch is not ok", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    } as Response);

    try {
      const payload: PaymentPayload = {
        x402Version: 1,
        scheme: "exact",
        network: "casper",
        payload: {},
      };
      const req: PaymentRequirements = buildPaymentRequirements("100", "res1");

      await expect(verifyAndSettle(payload, req)).rejects.toThrow(
        "x402 facilitator /verify → 500 Internal Server Error"
      );
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
