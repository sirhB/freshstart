import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getCaseBundle } from "@/lib/cases";
import { CasePortal } from "./CasePortal";

export const dynamic = "force-dynamic";

export default async function CasePage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  const bundle = await getCaseBundle(caseId);
  const initialBundle = bundle ? JSON.parse(JSON.stringify(bundle)) : null;

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="paper-grain flex-1 px-5 py-10 sm:px-8 lg:px-12">
        <CasePortal caseId={caseId} initialBundle={initialBundle} />
      </main>
      <SiteFooter />
    </div>
  );
}
