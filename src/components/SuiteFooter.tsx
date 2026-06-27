// Shared Vouch-suite footer.

export function SuiteFooter() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

  return (
    <footer className="mt-16 border-t border-slate-800/60 pt-6 text-sm text-slate-500">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
        <span>Built on the verified Casper surface —</span>
        <span className="rounded border border-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
          x402
        </span>
        <span className="rounded border border-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
          casper-eip-712
        </span>
        <span className="rounded border border-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
          Odra
        </span>
        <span className="rounded border border-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
          CSPR.cloud
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-slate-600">
          All code original and newly developed for the Casper Agentic Buildathon 2026. Part of the{" "}
          <span className="text-slate-400">Vouch</span> suite:{" "}
          <span className="text-slate-500">Conclave</span> (governance) · Verity (oracle) ·{" "}
          <span className="text-slate-500">Bastion</span> (ZK compliance).
        </p>
        <span className="shrink-0 rounded border border-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-500">
          v{version}
        </span>
      </div>
    </footer>
  );
}

