// x402 pay-to-check explainer — verify the proof, learn nothing else.

export function X402CheckPanel() {
  return (
    <section className="mt-8">
      <h2 className="text-xs font-medium uppercase tracking-widest text-slate-500">
        x402 Pay-to-Check
      </h2>
      <div className="mt-4 rounded-lg p-4 glass-elevated">
        <p className="text-sm text-slate-300">
          A mock dApp submits a holder&apos;s ZK proof to{" "}
          <code className="font-mono text-cyan-400">/check</code> →{" "}
          <span className="text-amber-300">402</span> → EIP-712 CEP-18 payment →{" "}
          <span className="text-green-300">200</span>{" "}
          <code className="font-mono text-green-400">{`{ compliant: true }`}</code>
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Boolean only — never identity. Settlement deploy hash shown. Reinforces &quot;verify the
          proof, learn nothing else.&quot;
        </p>
      </div>
    </section>
  );
}
