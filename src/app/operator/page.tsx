import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { OperatorConsole } from "./OperatorConsole";

export default function OperatorPage() {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="paper-grain flex-1 px-5 py-10 sm:px-8 lg:px-12">
        <OperatorConsole />
      </main>
      <SiteFooter />
    </div>
  );
}
