"use client";

import { useCallback, useState } from "react";

// Interactive compliance console.
// Drives the real /api/console orchestration: issue → prove → verify, then
// autonomous revocation. Revoking the sanctioned holder flips their ZK proof from
// ✓ to ✗ live, ejects them from the pool, and updates the on-chain Merkle root —
// while every other holder's proof keeps verifying.

interface HolderView {
  id: string;
  status: "valid" | "revoked" | "expired" | "declined";
  documentType: string;
  nationality: string;
  proofVerifies: boolean;
  proofReason: string | null;
  inPool: boolean;
  nullifierHash: string | null;
  revocationDeployHash: string | null;
  riskReason: string | null;
  commitmentHash: string | null;
}

interface RevocationMemo {
  holderId: string;
  memo: string;
  severity: "critical" | "high" | "medium";
}

interface OfficerReview {
  memos: RevocationMemo[];
  privacyAttestation: string;
  model: string;
}

interface Snapshot {
  poolId: string;
  root: string;
  activeCount: number;
  totalHolders: number;
  revokedNullifiers: string[];
  watchHolderId: string | null;
  holders: HolderView[];
  /** Real Claude compliance-officer review — null when keyless or nothing revoked. */
  officerReview?: OfficerReview | null;
}

const STATUS_STYLE: Record<string, { label: string; dot: string; cls: string }> = {
  valid: { label: "VALID", dot: "bg-green-400", cls: "text-green-300 border-green-400/30 bg-green-400/10" },
  revoked: { label: "REVOKED", dot: "bg-red-400", cls: "text-red-300 border-red-400/30 bg-red-400/10" },
  declined: { label: "DECLINED", dot: "bg-slate-500", cls: "text-slate-400 border-slate-500/30 bg-slate-500/10" },
  expired: { label: "EXPIRED", dot: "bg-amber-400", cls: "text-amber-300 border-amber-400/30 bg-amber-400/10" },
};

export function ComplianceConsole({ initialSnapshot }: { initialSnapshot: Snapshot }) {
  const [snapshot, setSnapshot] = useState<Snapshot>(initialSnapshot);
  const [revoked, setRevoked] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<HolderView | null>(null);
  
  // Game feel / juice effects
  const [shouldShake, setShouldShake] = useState(false);
  const [shouldFlash, setShouldFlash] = useState(false);
  
  // Cryptographic trace display
  const [expandedTrace, setExpandedTrace] = useState<Record<string, boolean>>({});

  const toggleTrace = (id: string) => {
    setExpandedTrace((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const load = useCallback(async (revokeList: string[]) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/console", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revoke: revokeList }),
      });
      const data = (await res.json()) as Snapshot;
      if (!res.ok) throw new Error("Failed to load compliance state");
      setSnapshot(data);
      setRevoked(revokeList);
      return data;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const revoke = useCallback(
    async (holderId: string) => {
      if (revoked.includes(holderId)) return;

      // Trigger immediate visual alert
      setShouldFlash(true);
      setShouldShake(true);
      setTimeout(() => setShouldFlash(false), 700);
      setTimeout(() => setShouldShake(false), 500);

      const next = [...revoked, holderId];
      const data = await load(next);
      const justRevoked = data?.holders.find((h) => h.id === holderId);
      if (justRevoked) setBanner(justRevoked);
    },
    [revoked, load],
  );

  const reset = useCallback(async () => {
    setBanner(null);
    await load([]);
  }, [load]);

  const watchId = snapshot.watchHolderId;

  return (
    <section className={`mt-12 relative transition-all ${shouldShake ? "animate-shake" : ""}`}>
      {shouldFlash && (
        <div className="absolute inset-0 z-50 pointer-events-none rounded-2xl bg-red-500/10 border-2 border-red-500/40 animate-flashRed" />
      )}
      
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-medium uppercase tracking-widest text-slate-500">
          Gated RWA Pool — Compliance Console
        </h2>
        <span className="font-mono text-xs text-slate-500">
          members: {snapshot.activeCount}/{snapshot.totalHolders}
        </span>
      </div>

      {/* on-chain root + monitor status */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="min-w-0 rounded-lg p-4 glass-elevated">
          <p className="text-[10px] uppercase tracking-widest text-slate-500">On-chain Merkle root</p>
          <p key={snapshot.root} className="mt-1 break-all font-mono text-xs text-cyan-400 animate-slideDown">
            {snapshot.root}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            revoked nullifiers: {snapshot.revokedNullifiers.length}
          </p>
        </div>
        <div className="min-w-0 rounded-lg p-4 glass-elevated">
          <p className="text-[10px] uppercase tracking-widest text-slate-500">Monitor agent</p>
          <p className="mt-1 flex items-center gap-2 text-xs text-slate-300">
            <span className="h-1.5 w-1.5 animate-blink rounded-full bg-green-400" />
            {watchId
              ? `watching ${watchId} · OFAC SDN streaming feed`
              : "no active credentials under watch"}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            autonomously revokes on a sanctions hit
          </p>
        </div>
      </div>

      {/* risk banner */}
      {banner && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/5 p-4 risk-flash">
          <div className="flex items-start gap-3">
            <span className="text-lg text-red-400">⚠</span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-red-300">
                RISK SIGNAL: {banner.id} — {banner.riskReason ?? "compliance lapse"}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                → Monitor agent <strong className="text-red-300">REVOKED</strong> autonomously ·
                nullifier published · root updated · ejected from pool.
              </p>
              {banner.revocationDeployHash && (
                <p className="mt-1 font-mono text-xs text-cyan-400 break-all leading-normal">
                  ⛓{" "}
                  <a
                    href={`https://testnet.cspr.live/transaction/${banner.revocationDeployHash.replace(/^0x/, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-cyan-300 break-all"
                  >
                    revoke deploy/{banner.revocationDeployHash}
                  </a>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Claude compliance-officer review (real LLM; null when keyless) */}
      {snapshot.officerReview && (
        <div className="mt-4 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4 animate-slideDown">
          <div className="flex items-center gap-2">
            <p className="text-[10px] uppercase tracking-widest text-slate-500">
              Claude Compliance Officer
            </p>
            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-[9px] text-cyan-400">
              live · {snapshot.officerReview.model}
            </span>
          </div>
          <div className="mt-2 space-y-2">
            {snapshot.officerReview.memos.map((m) => (
              <div key={m.holderId} className="text-xs leading-relaxed text-slate-300">
                <span
                  className={`mr-2 rounded px-1.5 py-0.5 font-mono text-[9px] uppercase ${
                    m.severity === "critical"
                      ? "bg-red-500/15 text-red-300"
                      : m.severity === "high"
                        ? "bg-amber-500/15 text-amber-300"
                        : "bg-slate-500/15 text-slate-300"
                  }`}
                >
                  {m.severity}
                </span>
                <span className="font-mono text-slate-400">{m.holderId}</span> — {m.memo}
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] italic text-slate-500">
            🔒 Privacy attestation: {snapshot.officerReview.privacyAttestation}
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* holder grid */}
      <div className="mt-4 grid gap-3 stagger sm:grid-cols-3">
        {snapshot.holders.map((h) => {
          const style = STATUS_STYLE[h.status] ?? STATUS_STYLE.declined;
          return (
            <div
              key={h.id}
              className={`min-w-0 rounded-lg p-4 glass-elevated flex flex-col justify-between ${h.inPool ? "ring-1 ring-green-500/20" : ""}`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm text-slate-300">{h.id}</span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${style.cls}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                    {style.label}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {h.documentType} · {h.nationality}
                </p>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-slate-500">ZK proof</span>
                  <span className={h.proofVerifies ? "text-green-400" : "text-red-400"}>
                    {h.proofVerifies ? "✓ verifies" : "✕ fails"}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="text-slate-500">in pool</span>
                  <span className={h.inPool ? "text-green-400" : "text-slate-500"}>
                    {h.inPool ? "yes" : "no"}
                  </span>
                </div>
              </div>

              <div>
                {/* Cryptographic Trace Expander */}
                {h.commitmentHash && (
                  <div className="mt-3 border-t border-slate-800/60 pt-3">
                    <button
                      onClick={() => toggleTrace(h.id)}
                      className="flex w-full items-center justify-between text-[10px] uppercase tracking-wider text-slate-400 hover:text-cyan-400 transition-colors"
                    >
                      <span>ZK Proof Trace</span>
                      <span>{expandedTrace[h.id] ? "▲ Hide" : "▼ Show"}</span>
                    </button>
                    {expandedTrace[h.id] && (
                      <div className="mt-2 space-y-1.5 font-mono text-[9px] text-slate-400 leading-normal animate-slideDown">
                        <div className="rounded bg-slate-950/40 p-1.5 border border-slate-800/40">
                          <span className="block text-[8px] text-slate-500 uppercase tracking-widest">Commitment Leaf:</span>
                          <span className="block break-all text-cyan-500">{h.commitmentHash}</span>
                        </div>
                        {h.nullifierHash && (
                          <div className="rounded bg-slate-950/40 p-1.5 border border-slate-800/40">
                            <span className="block text-[8px] text-slate-500 uppercase tracking-widest">Nullifier Hash:</span>
                            <span className="block break-all text-amber-500">{h.nullifierHash}</span>
                          </div>
                        )}
                        <div className="rounded bg-slate-950/40 p-1.5 border border-slate-800/40">
                          <span className="block text-[8px] text-slate-500 uppercase tracking-widest">Root Hash:</span>
                          <span className="block break-all text-green-500">{snapshot.root}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {h.status === "valid" && (
                  <button
                    onClick={() => revoke(h.id)}
                    disabled={loading}
                    className="mt-3 w-full rounded-md border border-red-500/30 bg-red-500/5 px-3 py-1.5 text-xs font-medium text-red-300 transition-all hover:border-red-400/50 hover:bg-red-500/15 disabled:opacity-50"
                  >
                    {h.id === watchId ? "⚠ Inject sanctions hit" : "Revoke"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* controls */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {watchId && (
          <button
            onClick={() => revoke(watchId)}
            disabled={loading}
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition-all hover:border-red-400/50 hover:bg-red-500/20 disabled:opacity-50"
          >
            ⚠ Trigger OFAC hit on {watchId}
          </button>
        )}
        {revoked.length > 0 && (
          <button
            onClick={reset}
            disabled={loading}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-400 transition-all hover:border-slate-600 hover:text-slate-300 disabled:opacity-50"
          >
            Reset
          </button>
        )}
        {loading && <span className="text-xs text-slate-500">updating on-chain state…</span>}
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Every state change is real: proofs are generated and verified against the live Merkle root,
        revocation publishes a nullifier and removes the commitment, and the remaining holders
        re-prove against the new root. Only the deploy broadcast is stubbed for the demo.
      </p>
    </section>
  );
}
