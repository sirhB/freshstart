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
              Credit repair that works on your report — not your hope.
            </h1>
            <p className="animate-rise-delay-2 mt-5 max-w-lg text-base leading-relaxed text-fog/75">
              Upload your credit report PDF. We find what to dispute, prepare
              the letters, and can mail them for you.
            </p>
            <div className="animate-rise-delay-3 mt-9 flex flex-wrap gap-3">
              <Link
                href="/intake"
                className="inline-flex h-12 items-center justify-center bg-paper px-6 text-sm font-semibold text-ink transition hover:bg-fog"
              >
                Upload your PDF
              </Link>
              <Link
                href="/demo"
                className="inline-flex h-12 items-center justify-center border border-paper/25 px-6 text-sm font-semibold text-paper transition hover:border-paper/50 hover:bg-white/5"
              >
                See a sample first
              </Link>
            </div>
          </div>

          <div className="animate-rise-delay-2">
            <HeroDeskArt />
          </div>
        </div>
      </section>

      <section id="how-it-works" className="paper-grain border-t border-line px-5 py-24 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-signal">
            How it works
          </p>
          <h2 className="mt-3 max-w-2xl font-display text-4xl tracking-tight text-ink sm:text-5xl">
            From your report to the bureaus
          </h2>
          <p className="mt-4 max-w-2xl text-base text-muted">
            Fresh Start is built for people who want inaccurate or unfinished
            items challenged clearly — with letters you can keep, or that we
            send on your behalf.
          </p>

          <div className="mt-14 grid gap-10 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Share your report",
                copy: "Upload a PDF of your credit report. We’ll review accounts, collections, and inquiries across the bureaus.",
              },
              {
                step: "02",
                title: "We build your disputes",
                copy: "You see what we’re challenging and why. Nothing goes out without a clear basis tied to your file.",
              },
              {
                step: "03",
                title: "Letters in your hands — or theirs",
                copy: "Download bureau-ready letters, or let Fresh Start mail them for you so the process keeps moving.",
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

      <section id="why-us" className="bg-ink px-5 py-24 text-paper sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brass">
              Why Fresh Start
            </p>
            <h2 className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">
              A personal company that treats your file with care
            </h2>
            <p className="mt-4 text-base leading-relaxed text-fog/75">
              No generic templates dumped on every account. We focus on your
              report, your items, and a path you can follow.
            </p>
          </div>

          <ul className="space-y-0 border-t border-white/10">
            {[
              "Clear review of what’s hurting your credit",
              "Dispute letters written for each bureau",
              "Download your packet — or have us mail it",
              "Straight talk about process, timing, and expectations",
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
              Watch a sample repair in two minutes
            </h2>
            <p className="mt-3 max-w-xl text-muted">
              Use a sample credit report, see flagged items, and preview the
              letters Fresh Start would prepare for someone in your shoes.
            </p>
          </div>
          <Link
            href="/demo"
            className="inline-flex h-12 shrink-0 items-center justify-center bg-ink px-7 text-sm font-semibold text-paper transition hover:bg-ink-soft"
          >
            Try the sample
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
