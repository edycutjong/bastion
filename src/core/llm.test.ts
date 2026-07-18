import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  llmConfigured: vi.fn(),
  structuredCall: vi.fn(),
}));

vi.mock("@/lib/anthropic", () => ({
  llmConfigured: mocks.llmConfigured,
  structuredCall: mocks.structuredCall,
}));

import { reviewRevocations, _resetOfficerCache } from "./llm";
import { buildSnapshot } from "@/lib/compliance";

describe("LLM compliance officer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetOfficerCache();
  });

  it("returns null when nothing is revoked (no call made)", async () => {
    mocks.llmConfigured.mockReturnValue(true);
    expect(await reviewRevocations(buildSnapshot([]))).toBeNull();
    expect(mocks.structuredCall).not.toHaveBeenCalled();
  });

  it("returns null without an API key (deterministic fallback)", async () => {
    mocks.llmConfigured.mockReturnValue(false);
    expect(await reviewRevocations(buildSnapshot(["mallory"]))).toBeNull();
    expect(mocks.structuredCall).not.toHaveBeenCalled();
  });

  it("returns null when the Claude call fails (graceful degradation)", async () => {
    mocks.llmConfigured.mockReturnValue(true);
    mocks.structuredCall.mockRejectedValue(new Error("api down"));
    expect(await reviewRevocations(buildSnapshot(["mallory"]))).toBeNull();
  });

  it("returns memos + privacy attestation and stamps the model", async () => {
    mocks.llmConfigured.mockReturnValue(true);
    mocks.structuredCall.mockResolvedValue({
      memos: [{ holderId: "mallory", memo: "Sanctions hit; nullifier published.", severity: "critical" }],
      privacyAttestation: "Inputs contained only hashes and event metadata; no PII.",
    });
    const review = await reviewRevocations(buildSnapshot(["mallory"]));
    expect(review?.memos[0].holderId).toBe("mallory");
    expect(review?.memos[0].severity).toBe("critical");
    expect(review?.privacyAttestation).toMatch(/no PII/i);
    expect(review?.model).toBeTruthy();
  });

  it("caches per revocation-set digest — one Claude call for identical inputs", async () => {
    mocks.llmConfigured.mockReturnValue(true);
    mocks.structuredCall.mockResolvedValue({
      memos: [{ holderId: "mallory", memo: "m", severity: "critical" }],
      privacyAttestation: "hashes only",
    });
    await reviewRevocations(buildSnapshot(["mallory"]));
    await reviewRevocations(buildSnapshot(["mallory"]));
    expect(mocks.structuredCall).toHaveBeenCalledTimes(1);
  });

  it("never lets the LLM alter deterministic state (snapshot untouched)", async () => {
    mocks.llmConfigured.mockReturnValue(true);
    mocks.structuredCall.mockResolvedValue({
      memos: [{ holderId: "alice", memo: "attempting to revoke alice", severity: "critical" }],
      privacyAttestation: "n/a",
    });
    const snapshot = buildSnapshot(["mallory"]);
    const before = JSON.stringify(snapshot.holders.map((h) => [h.id, h.status, h.proofVerifies]));
    await reviewRevocations(snapshot);
    expect(JSON.stringify(snapshot.holders.map((h) => [h.id, h.status, h.proofVerifies]))).toBe(before);
  });
});
