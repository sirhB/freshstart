import Link from "next/link";

export function SiteHeader({ tone = "light" }: { tone?: "light" | "dark" }) {
  const dark = tone === "dark";

  return (
    <header
      className={`relative z-20 flex items-center justify-between gap-6 px-5 py-5 sm:px-8 lg:px-12 ${
        dark ? "text-paper" : "text-ink"
      }`}
    >
      <Link href="/" className="group flex items-baseline gap-2">
        <span
          className={`font-display text-2xl tracking-tight sm:text-[1.7rem] ${
            dark ? "text-paper" : "text-ink"
          }`}
        >
          Fresh Start
        </span>
        <span
          className={`hidden text-[11px] font-medium uppercase tracking-[0.22em] sm:inline ${
            dark ? "text-fog/70" : "text-muted"
          }`}
        >
          Agency
        </span>
      </Link>

      <nav className="hidden items-center gap-8 text-sm md:flex">
        <Link
          href="/#workflow"
          className={dark ? "text-fog/85 hover:text-paper" : "text-muted hover:text-ink"}
        >
          Workflow
        </Link>
        <Link
          href="/#operations"
          className={dark ? "text-fog/85 hover:text-paper" : "text-muted hover:text-ink"}
        >
          Operations
        </Link>
        <Link
          href="/demo"
          className={dark ? "text-fog/85 hover:text-paper" : "text-muted hover:text-ink"}
        >
          Demo
        </Link>
      </nav>

      <div className="flex items-center gap-3">
        <Link
          href="/demo"
          className={`inline-flex h-11 items-center justify-center px-5 text-sm font-semibold transition ${
            dark
              ? "bg-paper text-ink hover:bg-fog"
              : "bg-ink text-paper hover:bg-ink-soft"
          }`}
        >
          Try the demo
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-ink px-5 py-14 text-fog sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-display text-3xl text-paper">Fresh Start</p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-fog/75">
            The operating system for credit repair agencies — intake, dispute
            packets, and mailing workflow in one polished desk.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-fog/70">
          <Link href="/demo" className="hover:text-paper">
            Interactive demo
          </Link>
          <Link href="/#workflow" className="hover:text-paper">
            Workflow
          </Link>
          <Link href="/#operations" className="hover:text-paper">
            Operations
          </Link>
        </div>
      </div>
      <p className="mx-auto mt-12 max-w-6xl text-xs leading-relaxed text-fog/45">
        Fresh Start is a software demonstration. It is not a credit repair
        organization, law firm, or consumer reporting agency. Generated letters
        are samples for product evaluation only and are not legal advice. Credit
        repair services are regulated under the Credit Repair Organizations Act
        (CROA) and applicable state law.
      </p>
    </footer>
  );
}
