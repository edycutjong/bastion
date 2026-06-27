import { describe, it, expect, vi } from "vitest";
import { buildSnapshot } from "./compliance";
import { loadExpectedStates } from "./fixtures";
import * as zk from "@/core/zk";

// The orchestrator is the source of truth for the home page and /api/console.
// These guard the headline story: a sanctions hit autonomously revokes one holder
// without touching anyone else's proof.

describe("buildSnapshot", () => {
  it("initial state: valid holders' proofs verify and they're in the pool", () => {
    const snap = buildSnapshot([]);

    const alice = snap.holders.find((h) => h.id === "alice")!;
    expect(alice.status).toBe("valid");
    expect(alice.proofVerifies).toBe(true);
    expect(alice.inPool).toBe(true);

    const carol = snap.holders.find((h) => h.id === "carol")!;
    expect(carol.status).toBe("declined");
    expect(carol.proofVerifies).toBe(false);
    expect(carol.inPool).toBe(false);

    expect(snap.activeCount).toBe(snap.holders.filter((h) => h.inPool).length);
    expect(snap.revokedNullifiers).toHaveLength(0);
    expect(snap.watchHolderId).toBe("mallory");
  });

  it("is serializable and deterministic for a given revoke set", () => {
    const a = buildSnapshot(["mallory"]);
    const b = buildSnapshot(["mallory"]);
    expect(() => JSON.parse(JSON.stringify(a))).not.toThrow();
    expect(a.root).toBe(b.root);
    expect(a.holders.map((h) => `${h.id}:${h.proofVerifies}`)).toEqual(
      b.holders.map((h) => `${h.id}:${h.proofVerifies}`),
    );
  });

  it("revoking the sanctioned holder flips only their proof and updates the root", () => {
    const before = buildSnapshot([]);
    const after = buildSnapshot(["mallory"]);

    const malloryAfter = after.holders.find((h) => h.id === "mallory")!;
    expect(malloryAfter.status).toBe("revoked");
    expect(malloryAfter.proofVerifies).toBe(false);
    expect(malloryAfter.inPool).toBe(false);
    expect(malloryAfter.revocationDeployHash).toMatch(/^0x/);

    // alice is untouched
    const aliceAfter = after.holders.find((h) => h.id === "alice")!;
    expect(aliceAfter.proofVerifies).toBe(true);
    expect(aliceAfter.inPool).toBe(true);

    // root changed; a nullifier was published; pool shrank
    expect(after.root).not.toBe(before.root);
    expect(after.revokedNullifiers).toHaveLength(1);
    expect(after.activeCount).toBe(before.activeCount - 1);
    expect(after.watchHolderId).toBeNull();
  });
});

describe("loadExpectedStates", () => {
  it("loads expected states successfully", () => {
    expect(loadExpectedStates()).toBeDefined();
  });
});

describe("buildSnapshot Edge Cases", () => {
  it("handles skipped holder and manual revocation", () => {
    const snap = buildSnapshot(["carol", "alice"]);
    expect(snap.root).toBeDefined();

    const alice = snap.holders.find((h) => h.id === "alice")!;
    expect(alice.status).toBe("revoked");
    expect(alice.riskReason).toBe("Manual revocation by compliance operator");
  });

  it("handles missing info fallback during revoked status mapping", () => {
    const originalGet = Map.prototype.get;
    Map.prototype.get = function (key: any) {
      if (key === "alice") {
        return {
          status: "revoked",
          riskEvents: [],
        };
      }
      return (originalGet as (this: unknown, key: unknown) => unknown).call(this, key);
    };

    try {
      const snap = buildSnapshot([]);
      const alice = snap.holders.find((h) => h.id === "alice")!;
      expect(alice.status).toBe("revoked");
      expect(alice.nullifierHash).toBeNull();
      expect(alice.revocationDeployHash).toBeNull();
      expect(alice.riskReason).toBeNull();
    } finally {
      Map.prototype.get = originalGet;
    }
  });

  it("handles proof verification failure in buildSnapshot", () => {
    const verifySpy = vi.spyOn(zk, "verifyProof").mockReturnValue({
      valid: false,
      reason: "Mock proof verification failure",
    });

    try {
      const snap = buildSnapshot([]);
      const alice = snap.holders.find((h) => h.id === "alice")!;
      expect(alice.proofVerifies).toBe(false);
      expect(alice.proofReason).toBe("Mock proof verification failure");
    } finally {
      verifySpy.mockRestore();
    }
  });

  it("handles proof verification failure in buildSnapshot with null reason", () => {
    const verifySpy = vi.spyOn(zk, "verifyProof").mockReturnValue({
      valid: false,
      reason: null as any,
    });

    try {
      const snap = buildSnapshot([]);
      const alice = snap.holders.find((h) => h.id === "alice")!;
      expect(alice.proofVerifies).toBe(false);
      expect(alice.proofReason).toBeNull();
    } finally {
      verifySpy.mockRestore();
    }
  });

  it("handles proof verification failure in buildSnapshot with undefined reason", () => {
    const verifySpy = vi.spyOn(zk, "verifyProof").mockReturnValue({
      valid: false,
      reason: undefined as any,
    });

    try {
      const snap = buildSnapshot([]);
      const alice = snap.holders.find((h) => h.id === "alice")!;
      expect(alice.proofVerifies).toBe(false);
      expect(alice.proofReason).toBeNull();
    } finally {
      verifySpy.mockRestore();
    }
  });
});
