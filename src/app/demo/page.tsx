import { DemoWizard } from "@/components/DemoWizard";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

export const metadata = {
  title: "Demo — Fresh Start Agency",
  description:
    "Interactive Fresh Start demo: upload a credit report, review disputes, generate letters, and queue mailing.",
};

export default function DemoPage() {
  return (
    <div className="flex min-h-full flex-col paper-grain">
      <SiteHeader tone="light" />
      <main className="flex-1 px-5 py-10 sm:px-8 lg:min-h-[70vh] lg:px-12 lg:py-14">
        <DemoWizard />
      </main>
      <SiteFooter />
    </div>
  );
}
