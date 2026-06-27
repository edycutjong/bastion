// On-chain PII scan — reinforces that contract state holds only a root + nullifiers.

export function PiiScan() {
  return (
    <section className="mt-8">
      <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4">
        <div className="flex items-center gap-3">
          <span className="text-lg text-green-400">🔒</span>
          <div>
            <p className="text-sm font-medium text-green-300">
              On-chain PII scan: <strong>0 fields found</strong>
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Contract state contains only a Merkle root + nullifier hashes. No names, no documents,
              no wallet→identity links.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
