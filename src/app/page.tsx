import { BastionHero } from "@/components/BastionHero";
import { CoreFlow } from "@/components/CoreFlow";
import { ComplianceConsole } from "@/components/ComplianceConsole";
import { PiiScan } from "@/components/PiiScan";
import { X402CheckPanel } from "@/components/X402CheckPanel";
import { WhyCasper } from "@/components/WhyCasper";
import { SuiteFooter } from "@/components/SuiteFooter";
import { buildSnapshot } from "@/lib/compliance";

export default function Home() {
  const initialSnapshot = buildSnapshot([]);
  return (
    <main className="min-h-screen grid-bg relative overflow-hidden">
      <div className="nebula-glow" />
      <div className="scanline" />
      <div className="mx-auto max-w-5xl px-6 py-12 relative z-10">
        <BastionHero />
        <CoreFlow />
        <ComplianceConsole initialSnapshot={initialSnapshot} />
        <PiiScan />
        <X402CheckPanel />
        <WhyCasper />
        <SuiteFooter />
      </div>
    </main>
  );
}
