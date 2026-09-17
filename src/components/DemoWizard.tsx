"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  DEMO_CLIENT,
  NEGATIVE_ITEMS,
  buildLetter,
  type Bureau,
  type NegativeItem,
} from "@/lib/demo-data";

type Step = "upload" | "analyze" | "select" | "letters";

const STEPS: { id: Step; label: string }[] = [
  { id: "upload", label: "Intake" },
  { id: "analyze", label: "Analyze" },
  { id: "select", label: "Dispute" },
  { id: "letters", label: "Letters" },
];

const BUREAUS: Bureau[] = ["Equifax", "Experian", "TransUnion"];

export function DemoWizard() {
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(NEGATIVE_ITEMS.filter((i) => i.recommended).map((i) => i.id)),
  );
  const [activeBureau, setActiveBureau] = useState<Bureau>("Equifax");
  const [mailQueued, setMailQueued] = useState(false);
  const [, startTransition] = useTransition();

  const selectedItems = useMemo(
    () => NEGATIVE_ITEMS.filter((item) => selected.has(item.id)),
    [selected],
  );

  const letter = useMemo(
    () => buildLetter(DEMO_CLIENT, activeBureau, selectedItems),
    [activeBureau, selectedItems],
  );

  function onFile(file: File | null) {
    if (!file) return;
    setFileName(file.name);
  }

  function startAnalysis() {
    setAnalyzing(true);
    setProgress(8);
    setStep("analyze");

    const ticks = [22, 41, 63, 78, 92, 100];
    ticks.forEach((value, index) => {
      window.setTimeout(() => {
        setProgress(value);
        if (value === 100) {
          window.setTimeout(() => {
            setAnalyzing(false);
            startTransition(() => setStep("select"));
          }, 450);
        }
      }, 380 * (index + 1));
    });
  }

  function toggleItem(item: NegativeItem) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  }

  function downloadLetter() {
    const blob = new Blob([letter], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fresh-start-${activeBureau.toLowerCase()}-dispute.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function queueMail() {
    setMailQueued(true);
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-signal">
            Agency demo
          </p>
          <h1 className="mt-2 font-display text-4xl tracking-tight text-ink sm:text-5xl">
            Run a client dispute from your desk
          </h1>
          <p className="mt-3 max-w-xl text-base text-muted">
            Upload a sample credit report PDF, review flagged items, generate
            bureau letters, then download or queue mailing. This flow uses mock
            analysis — real AI parsing ships next.
          </p>
        </div>
        <Link href="/" className="text-sm font-medium text-ink-soft underline-offset-4 hover:underline">
          Back to Fresh Start
        </Link>
      </div>

      <ol className="mb-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STEPS.map((s, index) => {
          const active = s.id === step;
          const done = STEPS.findIndex((x) => x.id === step) > index;
          return (
            <li
              key={s.id}
              className={`border px-4 py-3 text-sm ${
                active
                  ? "border-ink bg-ink text-paper"
                  : done
                    ? "border-signal/40 bg-signal/10 text-signal-deep"
                    : "border-line bg-paper text-muted"
              }`}
            >
              <span className="block text-[10px] uppercase tracking-[0.18em] opacity-70">
                Step {index + 1}
              </span>
              <span className="font-semibold">{s.label}</span>
            </li>
          );
        })}
      </ol>

      {step === "upload" && (
        <section className="animate-rise grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="border border-line bg-paper p-6 sm:p-8">
            <h2 className="font-display text-2xl text-ink">Client intake</h2>
            <p className="mt-2 text-sm text-muted">
              In production, your team attaches the client&apos;s bureau PDF
              (or the client uploads via portal). For this demo, drop any PDF.
            </p>

            <div className="mt-6 rounded-[2px] border border-dashed border-line bg-mist/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                Active client
              </p>
              <p className="mt-2 font-display text-xl text-ink">{DEMO_CLIENT.name}</p>
              <p className="text-sm text-muted">
                {DEMO_CLIENT.address} · {DEMO_CLIENT.cityStateZip}
              </p>
            </div>

            <label className="mt-6 flex cursor-pointer flex-col items-center justify-center border border-line bg-mist px-6 py-14 text-center transition hover:border-signal/50 hover:bg-fog/60">
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              />
              <span className="font-display text-2xl text-ink">
                {fileName ? "Report attached" : "Drop credit report PDF"}
              </span>
              <span className="mt-2 max-w-sm text-sm text-muted">
                {fileName
                  ? fileName
                  : "Accepts PDF exports from major report providers. Analysis is simulated."}
              </span>
            </label>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={!fileName}
                onClick={startAnalysis}
                className="inline-flex h-12 items-center justify-center bg-ink px-6 text-sm font-semibold text-paper transition hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-40"
              >
                Analyze report
              </button>
              <button
                type="button"
                onClick={() => {
                  setFileName("Sample_Credit_Report_Jordan_Hale.pdf");
                }}
                className="inline-flex h-12 items-center justify-center border border-line px-6 text-sm font-semibold text-ink transition hover:bg-mist"
              >
                Use sample PDF
              </button>
            </div>
          </div>

          <aside className="letter-sheet p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brass">
              What agencies get
            </p>
            <ul className="mt-5 space-y-4 text-sm leading-relaxed text-ink-soft">
              <li>Bureau-aware item extraction across Equifax, Experian, TransUnion.</li>
              <li>Dispute grounds suggested per tradeline — you stay in control.</li>
              <li>Printable letters for the client, or a mailing queue for your team.</li>
              <li>Audit-ready trail for every round (coming with the live product).</li>
            </ul>
          </aside>
        </section>
      )}

      {step === "analyze" && (
        <section className="animate-rise border border-line bg-paper p-8 sm:p-12">
          <h2 className="font-display text-3xl text-ink">Reading the report</h2>
          <p className="mt-2 text-muted">
            Mock parser scanning tradelines, inquiries, and collection accounts…
          </p>
          <div className="mt-8 h-2 overflow-hidden bg-fog">
            <div
              className={`h-full ${analyzing ? "progress-shimmer" : "bg-signal"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-3 text-sm font-medium text-ink-soft">{progress}% complete</p>
          <ul className="mt-8 space-y-3 text-sm text-muted">
            <li className={progress >= 22 ? "text-ink" : ""}>
              · Personal identity block matched
            </li>
            <li className={progress >= 41 ? "text-ink" : ""}>
              · Revolving & installment accounts indexed
            </li>
            <li className={progress >= 63 ? "text-ink" : ""}>
              · Negative statuses flagged across bureaus
            </li>
            <li className={progress >= 92 ? "text-ink" : ""}>
              · Dispute recommendations prepared
            </li>
          </ul>
        </section>
      )}

      {step === "select" && (
        <section className="animate-rise">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-3xl text-ink">Flagged items</h2>
              <p className="mt-2 text-sm text-muted">
                Report date {DEMO_CLIENT.reportDate}. Scores:{" "}
                {DEMO_CLIENT.scores.map((s) => `${s.bureau} ${s.score}`).join(" · ")}
              </p>
            </div>
            <button
              type="button"
              disabled={selected.size === 0}
              onClick={() => setStep("letters")}
              className="inline-flex h-12 items-center justify-center bg-ink px-6 text-sm font-semibold text-paper transition hover:bg-ink-soft disabled:opacity-40"
            >
              Generate letters ({selected.size})
            </button>
          </div>

          <div className="space-y-3">
            {NEGATIVE_ITEMS.map((item) => {
              const checked = selected.has(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleItem(item)}
                  className={`w-full border p-5 text-left transition ${
                    checked
                      ? "border-signal bg-signal/10"
                      : "border-line bg-paper hover:border-ink/30"
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-display text-xl text-ink">{item.creditor}</p>
                        {item.recommended && (
                          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-signal-deep">
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        {item.accountType} · {item.status}
                      </p>
                      <p className="mt-2 text-sm text-ink-soft">{item.disputeGround}</p>
                    </div>
                    <div className="text-sm text-muted sm:text-right">
                      <p className="font-semibold text-ink">{item.balance}</p>
                      <p className="mt-1">{item.bureaus.join(" · ")}</p>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-ink">
                        {checked ? "Selected" : "Tap to select"}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {step === "letters" && (
        <section className="animate-rise grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <h2 className="font-display text-3xl text-ink">Dispute letters</h2>
            <p className="mt-2 text-sm text-muted">
              One packet per bureau. Provide to the client, or queue for your
              mailing desk.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {BUREAUS.map((bureau) => (
                <button
                  key={bureau}
                  type="button"
                  onClick={() => setActiveBureau(bureau)}
                  className={`h-10 px-4 text-sm font-semibold transition ${
                    activeBureau === bureau
                      ? "bg-ink text-paper"
                      : "border border-line bg-paper text-muted hover:text-ink"
                  }`}
                >
                  {bureau}
                </button>
              ))}
            </div>

            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={downloadLetter}
                className="flex h-12 w-full items-center justify-center bg-ink text-sm font-semibold text-paper transition hover:bg-ink-soft"
              >
                Download {activeBureau} letter
              </button>
              <button
                type="button"
                onClick={queueMail}
                className="flex h-12 w-full items-center justify-center border border-line text-sm font-semibold text-ink transition hover:bg-mist"
              >
                {mailQueued ? "Queued for mailing desk" : "Mail on behalf (stub)"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("upload");
                  setFileName(null);
                  setMailQueued(false);
                  setProgress(0);
                }}
                className="flex h-12 w-full items-center justify-center text-sm font-medium text-muted underline-offset-4 hover:text-ink hover:underline"
              >
                Restart demo
              </button>
            </div>

            {mailQueued && (
              <p className="mt-4 border border-signal/30 bg-signal/10 p-4 text-sm text-signal-deep">
                Mailing queue stub accepted. Live USPS / certified mail
                integration will attach here in the production build.
              </p>
            )}
          </div>

          <article className="letter-sheet max-h-[34rem] overflow-auto p-6 font-mono text-[12px] leading-relaxed text-ink-soft whitespace-pre-wrap sm:p-8">
            {letter}
          </article>
        </section>
      )}
    </div>
  );
}
