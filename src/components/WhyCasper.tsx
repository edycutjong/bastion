// The Casper-only surface this gateway is built on.

const TOOLS = [
  { 
    tool: "casper-eip-712 Signature Scheme", 
    usage: "Enables gasless credential issuance. The holder's PII remains strictly off-chain while producing a cryptographically secure signature matching EIP-712 parameters mapped to Casper account hashes.",
    badge: "Cryptography"
  },
  { 
    tool: "Odra Rust Smart Contract", 
    usage: "Stores the Merkle root and logs revoked nullifiers on-chain. Built using Odra, allowing upgradable proxy execution and strictly isolated state transitions to prevent any front-running attacks.",
    badge: "On-Chain Registry"
  },
  { 
    tool: "casper-js-sdk (Autonomous Signing)", 
    usage: "Allows the autonomous monitoring agent to build, sign, and broadcast 'insert_commitment' and 'revoke' transactions using standard PEM keys without relying on human browser wallet authorization.",
    badge: "Agent Integration"
  },
  { 
    tool: "x402 Micropayments Facilitator", 
    usage: "Implements pay-per-check proof verification via CEP-18 token flows, ensuring that high-throughput verification queries are monetized and settled on Casper with cryptographic proof of payment.",
    badge: "Monetization"
  },
  { 
    tool: "CSPR.cloud Streaming Engine", 
    usage: "Enables sub-second reactive auditing by streaming blockchain events. The autonomous monitor listens for compliance alerts and instantly triggers updates back to the registry.",
    badge: "Streaming Monitor"
  },
];

export function WhyCasper() {
  return (
    <section className="mt-12">
      <h2 className="text-xs font-medium uppercase tracking-widest text-slate-500">
        Casper Native Integration Architecture
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((item) => (
          <div key={item.tool} className="flex flex-col justify-between rounded-xl p-5 glass-elevated bento-card relative overflow-hidden group">
            <div className="absolute top-0 right-0 h-[2px] w-0 bg-linear-to-r from-transparent to-cyan-400 group-hover:w-full transition-all duration-500 animate-pulse" />
            <div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center rounded-md bg-cyan-500/10 px-2 py-0.5 text-[9px] font-medium text-cyan-400 ring-1 ring-inset ring-cyan-500/20">
                  {item.badge}
                </span>
              </div>
              <h3 className="mt-3 text-xs font-bold text-slate-200 tracking-wide text-glow">
                {item.tool}
              </h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed font-sans">
                {item.usage}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

