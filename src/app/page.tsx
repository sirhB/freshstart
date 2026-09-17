import Link from "next/link";
import { HeroDeskArt } from "@/components/HeroDeskArt";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

export default function HomePage() {
  return (
    <div className="flex min-h-full flex-col">
      <section className="hero-atmosphere relative min-h-[100svh] overflow-hidden text-paper">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }}
        />
        <SiteHeader tone="dark" />

        <div className="relative z-10 mx-auto grid min-h-[calc(100svh-5.5rem)] max-w-6xl items-center gap-12 px-5 pb-16 pt-6 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-12 lg:pb-20">
          <div>
            <p className="animate-rise font-display text-5xl leading-[0.95] tracking-tight text-paper sm:text-6xl lg:text-7xl">
              Fresh Start
            </p>
            <h1 className="animate-rise-delay-1 mt-6 max-w-xl text-xl font-medium leading-snug text-fog sm:text-2xl">
              The agency desk for credit repair — intake reports, craft dispute
              letters, deliver or mail.
            </h1>
            <p className="animate-rise-delay-2 mt-5 max-w-lg text-base leading-relaxed text-fog/75">
              Built for operators who manage clients at scale. Upload a PDF
              credit report, review flagged items, generate bureau packets, and
              either hand letters to clients or send them on their behalf.
            </p>
            <div className="animate-rise-delay-3 mt-9 flex flex-wrap gap-3">
              <Link
                href="/demo"
                className="inline-flex h-12 items-center justify-center bg-paper px-6 text-sm font-semibold text-ink transition hover:bg-fog"
              >
                Try the interactive demo
              </Link>
              <a
                href="#workflow"
                className="inline-flex h-12 items-center justify-center border border-paper/25 px-6 text-sm font-semibold text-paper transition hover:border-paper/50 hover:bg-white/5"
              >
                See the workflow
              </a>
            </div>
          </div>

          <div className="animate-rise-delay-2">
            <HeroDeskArt />
          </div>
        </div>
      </section>

      <section id="workflow" className="paper-grain border-t border-line px-5 py-24 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-signal">
            Workflow
          </p>
          <h2 className="mt-3 max-w-2xl font-display text-4xl tracking-tight text-ink sm:text-5xl">
            One composition from report to mailbox
          </h2>
          <p className="mt-4 max-w-2xl text-base text-muted">
            Fresh Start is designed for agency teams — not a consumer DIY
            gimmick. Your desk owns the client record, the dispute round, and
            the mailing decision.
          </p>

          <div className="mt-14 grid gap-10 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Intake the report",
                copy: "Attach a client PDF from any major bureau export. The demo simulates extraction; production will parse tradelines automatically.",
              },
              {
                step: "02",
                title: "Select disputes",
                copy: "Review flagged accounts, inquiries, and collections. Keep recommended items or curate the round yourself.",
              },
              {
                step: "03",
                title: "Deliver or mail",
                copy: "Generate Equifax, Experian, and TransUnion letters. Download for the client — or queue mailing on their behalf.",
              },
            ].map((item) => (
              <div key={item.step} className="border-t border-ink/15 pt-6">
                <p className="font-mono text-xs tracking-[0.2em] text-brass">
                  {item.step}
                </p>
                <h3 className="mt-3 font-display text-2xl text-ink">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">{item.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="operations" className="bg-ink px-5 py-24 text-paper sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brass">
              Operations
            </p>
            <h2 className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">
              Built like a firm, paced like a product
            </h2>
            <p className="mt-4 text-base leading-relaxed text-fog/75">
              Polished enough for clients to trust. Structured enough for your
              team to run rounds without spreadsheet chaos.
            </p>
          </div>

          <ul className="space-y-0 border-t border-white/10">
            {[
              "Client-centric desk with report history per file",
              "Bureau-specific letter packets with clear dispute grounds",
              "Download for DIY handoff or queue for agency mailing",
              "Compliance-minded language and audit stubs for future rounds",
            ].map((line) => (
              <li
                key={line}
                className="border-b border-white/10 py-5 text-lg text-fog"
              >
                {line}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="paper-grain px-5 py-24 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 border border-line bg-paper px-8 py-12 sm:px-12 lg:flex-row lg:items-center">
          <div>
            <h2 className="font-display text-3xl text-ink sm:text-4xl">
              Walk the desk in under two minutes
            </h2>
            <p className="mt-3 max-w-xl text-muted">
              No account required. Use the sample PDF, generate letters, and see
              how Fresh Start feels as an agency operating system.
            </p>
          </div>
          <Link
            href="/demo"
            className="inline-flex h-12 shrink-0 items-center justify-center bg-ink px-7 text-sm font-semibold text-paper transition hover:bg-ink-soft"
          >
            Launch demo
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
