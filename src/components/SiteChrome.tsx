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
      </Link>

      <nav className="hidden items-center gap-8 text-sm md:flex">
        <Link
          href="/#how-it-works"
          className={dark ? "text-fog/85 hover:text-paper" : "text-muted hover:text-ink"}
        >
          How it works
        </Link>
        <Link
          href="/#why-us"
          className={dark ? "text-fog/85 hover:text-paper" : "text-muted hover:text-ink"}
        >
          Why us
        </Link>
        <Link
          href="/demo"
          className={dark ? "text-fog/85 hover:text-paper" : "text-muted hover:text-ink"}
        >
          See a sample
        </Link>
        <Link
          href="/operator"
          className={dark ? "text-fog/85 hover:text-paper" : "text-muted hover:text-ink"}
        >
          Operator
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
          Start your review
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
            Personal credit repair — we review your report, prepare dispute
            letters, and can mail them for you.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-fog/70">
          <Link href="/demo" className="hover:text-paper">
            See a sample
          </Link>
          <Link href="/operator" className="hover:text-paper">
            Operator desk
          </Link>
          <Link href="/#how-it-works" className="hover:text-paper">
            How it works
          </Link>
          <Link href="/#why-us" className="hover:text-paper">
            Why us
          </Link>
        </div>
      </div>
      <p className="mx-auto mt-12 max-w-6xl text-xs leading-relaxed text-fog/45">
        Fresh Start helps consumers dispute inaccurate or incomplete credit
        report items. Results vary. This site includes an interactive product
        demonstration; sample letters are not legal advice. Credit repair
        services are regulated under the Credit Repair Organizations Act (CROA)
        and applicable state law.
      </p>
    </footer>
  );
}
