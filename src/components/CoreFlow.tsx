// The one core flow — the seven steps from documents to autonomous revocation.

const FLOW = [
  "User submits documents off-chain — PII never touches the chain",
  "Verifier agent reviews and decides (approve / decline)",
  "Gasless EIP-712 credential issued + Poseidon commitment inserted into on-chain Merkle set",
  "Holder generates a Groth16 ZK proof of “valid & non-revoked” in-browser — secret never leaves the device",
  "Gated pool admits the holder (proof verified against the on-chain Merkle root)",
  "Monitor agent detects a risk signal (sanctions hit / anomaly)",
  "Autonomous REVOCATION — nullifier published, root updated, proof stops verifying, pool ejects",
];

export function CoreFlow() {
  return (
    <section className="mt-10 animate-slideUp">
      <h2 className="text-xs font-medium uppercase tracking-widest text-slate-500">
        The one core flow
      </h2>
      <ol className="mt-4 grid gap-2 sm:grid-cols-7">
        {FLOW.map((step, i) => (
          <li key={i} className="rounded-lg p-3 glass-elevated">
            <div className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 text-[10px] font-bold text-cyan-400">
              {i + 1}
            </div>
            <p className="mt-2 text-[11px] leading-snug text-slate-300">{step}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
