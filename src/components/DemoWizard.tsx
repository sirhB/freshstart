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
  { id: "upload", label: "Upload" },
  { id: "analyze", label: "Review" },
  { id: "select", label: "Disputes" },
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
            Sample journey
          </p>
          <h1 className="mt-2 font-display text-4xl tracking-tight text-ink sm:text-5xl">
            See what Fresh Start does with a credit report
          </h1>
          <p className="mt-3 max-w-xl text-base text-muted">
            This walkthrough uses a sample file for {DEMO_CLIENT.name}. Upload
            any PDF or use ours, then preview dispute letters — analysis is
            simulated for the demo.
          </p>
        </div>
        <Link href="/" className="text-sm font-medium text-ink-soft underline-offset-4 hover:underline">
          Back to Fresh Start
        </Link>
      </div>

      <ol className="sticky top-0 z-10 mb-8 grid grid-cols-2 gap-2 bg-mist/95 py-3 backdrop-blur-sm sm:grid-cols-4">
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
            <h2 className="font-display text-2xl text-ink">Upload your report</h2>
            <p className="mt-2 text-sm text-muted">
              In the real product, you upload your own bureau PDF. For this
              sample, drop any PDF or use the prepared file below.
            </p>

            <div className="mt-6 rounded-[2px] border border-dashed border-line bg-mist/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                Sample profile
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
                {fileName ? "Report ready" : "Drop your credit report PDF"}
              </span>
              <span className="mt-2 max-w-sm text-sm text-muted">
                {fileName
                  ? fileName
                  : "PDF exports from major credit report providers work best. Analysis is simulated here."}
              </span>
            </label>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={!fileName}
                onClick={startAnalysis}
                className="inline-flex h-12 items-center justify-center bg-ink px-6 text-sm font-semibold text-paper transition hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-40"
              >
                Review my report
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
              What you get
            </p>
            <ul className="mt-5 space-y-4 text-sm leading-relaxed text-ink-soft">
              <li>A clear list of items that may be disputable on your report.</li>
              <li>Suggested reasons for each challenge — you stay in the loop.</li>
              <li>Letters for Equifax, Experian, and TransUnion.</li>
              <li>Download your packet, or ask Fresh Start to mail it for you.</li>
            </ul>
          </aside>
        </section>
      )}

      {step === "analyze" && (
        <section className="animate-rise border border-line bg-paper p-8 sm:p-12">
          <h2 className="font-display text-3xl text-ink">Reviewing your report</h2>
          <p className="mt-2 text-muted">
            Looking through accounts, inquiries, and collection items…
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
              · Confirming your identity details
            </li>
            <li className={progress >= 41 ? "text-ink" : ""}>
              · Mapping credit cards, loans, and accounts
            </li>
            <li className={progress >= 63 ? "text-ink" : ""}>
              · Flagging negative items across bureaus
            </li>
            <li className={progress >= 92 ? "text-ink" : ""}>
              · Preparing dispute recommendations
            </li>
          </ul>
        </section>
      )}

      {step === "select" && (
        <section className="animate-rise">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-3xl text-ink">Items to challenge</h2>
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
              Build my letters ({selected.size})
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
                            Suggested
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
                        {checked ? "Included" : "Tap to include"}
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
            <h2 className="font-display text-3xl text-ink">Your dispute letters</h2>
            <p className="mt-2 text-sm text-muted">
              One letter per bureau. Keep a copy, or have Fresh Start mail them
              for you.
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
                {mailQueued ? "We’ll mail this for you" : "Mail this for me"}
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
                Restart sample
              </button>
            </div>

            {mailQueued && (
              <p className="mt-4 border border-signal/30 bg-signal/10 p-4 text-sm text-signal-deep">
                Mailing request noted. In the live product, certified mail
                tracking will appear here after we send your letters.
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
