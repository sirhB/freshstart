import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { CasePortal } from "./CasePortal";

export default async function CasePage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="paper-grain flex-1 px-5 py-10 sm:px-8 lg:px-12">
        <CasePortal caseId={caseId} />
      </main>
      <SiteFooter />
    </div>
  );
}
