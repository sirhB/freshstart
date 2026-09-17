import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { listCases } from "@/lib/cases";
import { OperatorConsole } from "./OperatorConsole";

export const dynamic = "force-dynamic";

export default async function OperatorPage() {
  const cases = await listCases();
  const initialCases = cases.map((c) => ({
    id: c.id,
    title: c.title,
    status: c.status,
    waveNumber: c.waveNumber,
    updatedAt: c.updatedAt.toISOString(),
    consumer: { fullName: c.consumer.fullName },
    _count: c._count,
    approvals: c.approvals,
  }));

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="paper-grain flex-1 px-5 py-10 sm:px-8 lg:px-12">
        <OperatorConsole initialCases={initialCases} />
      </main>
      <SiteFooter />
    </div>
  );
}
