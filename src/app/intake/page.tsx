"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

const SAMPLE_CONSUMER = {
  fullName: "Jordan Hale",
  addressLine1: "1842 Meridian Avenue",
  cityStateZip: "Austin, TX 78702",
  dateOfBirth: "04/12/1991",
  phone: "(512) 555-0148",
  reportFileNumber: "FS-2026-0912-JH",
  ssnLast4: "4281",
};

const SAMPLE_TEXT = `Report date: September 12, 2026
File number: FS-2026-0912-JH
Equifax Experian TransUnion

Account: Synchrony Bank / Midland Credit
Account number: ****4412
Type: Collection
Status: Open collection
Balance: $1,204
Opened: 11/2020
Notes: not mine — identity mismatch

Account: OneMain Financial
Account number: ****2207
Type: Installment loan
Status: Late 30 / Late 60
Balance: $4,670
Opened: 07/2021
Notes: inaccurate late history vs payment statement

Account: Affirm
Type: Hard inquiry
Status: Hard pull
Balance: —
Opened: 08/2025
Notes: unauthorized inquiry no permissible purpose
Experian
`;

type Preview = {
  tradelineCount: number;
  warnings: string[];
  confidence: number;
  source: "pdf" | "text";
};

export default function IntakePage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  const acceptFile = useCallback((next: File | null) => {
    setError(null);
    setPreview(null);
    if (!next) {
      setFile(null);
      return;
    }
    if (next.type !== "application/pdf" && !next.name.toLowerCase().endsWith(".pdf")) {
      setError("Please upload a PDF credit report.");
      setFile(null);
      return;
    }
    if (next.size > 25 * 1024 * 1024) {
      setError("PDF must be under 25 MB.");
      setFile(null);
      return;
    }
    setFile(next);
    setShowPaste(false);
  }, []);

  async function parsePdf(createCase: boolean) {
    if (!file) {
      setError("Choose a PDF credit report to continue.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("createCase", createCase ? "true" : "false");
      if (createCase) {
        form.set("consumer", JSON.stringify(SAMPLE_CONSUMER));
      }
      const res = await fetch("/api/parse", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Parse failed");
      if (createCase && data.case?.id) {
        router.push(`/cases/${data.case.id}`);
        return;
      }
      setPreview({
        tradelineCount: data.parsed.tradelines.length,
        warnings: data.parsed.warnings ?? [],
        confidence: data.parsed.confidence ?? 0,
        source: "pdf",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Parse failed");
    } finally {
      setBusy(false);
    }
  }

  async function parseText(createCase: boolean) {
    if (!text.trim()) {
      setError("Paste report text, or upload a PDF instead.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          createCase,
          consumer: createCase ? SAMPLE_CONSUMER : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Parse failed");
      if (createCase && data.case?.id) {
        router.push(`/cases/${data.case.id}`);
        return;
      }
      setPreview({
        tradelineCount: data.parsed.tradelines.length,
        warnings: data.parsed.warnings ?? [],
        confidence: data.parsed.confidence ?? 0,
        source: "text",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Parse failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="paper-grain flex-1 px-5 py-10 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-signal">
            Report intake
          </p>
          <h1 className="mt-2 font-display text-4xl tracking-tight text-ink sm:text-5xl">
            Upload your credit report PDF
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
            Most people start with a PDF from AnnualCreditReport, Equifax,
            Experian, or TransUnion. Drop it here — we extract tradelines and
            open your dispute case.
          </p>

          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragOver(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              acceptFile(e.dataTransfer.files?.[0] ?? null);
            }}
            onClick={() => inputRef.current?.click()}
            className={`mt-10 cursor-pointer border-2 border-dashed px-6 py-14 text-center transition sm:px-10 sm:py-16 ${
              dragOver
                ? "border-signal bg-signal/10"
                : file
                  ? "border-signal bg-paper"
                  : "border-ink/25 bg-paper hover:border-ink/50 hover:bg-mist/60"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => acceptFile(e.target.files?.[0] ?? null)}
            />

            <div className="mx-auto flex h-16 w-16 items-center justify-center border border-ink/15 bg-mist">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
                className="text-ink"
              >
                <path
                  d="M7 3.5h6.5L19 9v11.5H7V3.5Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M13.5 3.5V9H19"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M9.5 14h5M9.5 17h3.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="square"
                />
              </svg>
            </div>

            {file ? (
              <>
                <p className="mt-6 font-display text-2xl text-ink">{file.name}</p>
                <p className="mt-2 text-sm text-muted">
                  {(file.size / 1024).toFixed(0)} KB · PDF ready to parse
                </p>
                <p className="mt-4 text-sm font-semibold text-signal">
                  Click to choose a different file
                </p>
              </>
            ) : (
              <>
                <p className="mt-6 font-display text-2xl text-ink sm:text-3xl">
                  Drop your credit report PDF here
                </p>
                <p className="mt-3 text-sm text-muted">
                  or click to browse — PDF only, up to 25 MB
                </p>
                <span className="mt-8 inline-flex h-12 items-center justify-center bg-ink px-7 text-sm font-semibold text-paper">
                  Choose PDF
                </span>
              </>
            )}
          </div>

          <p className="mt-4 text-xs leading-relaxed text-muted">
            Tip: download your free reports at AnnualCreditReport.com, then
            upload the PDF export. We only need the report file — no bureau
            login required.
          </p>

          {error && (
            <p className="mt-4 border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
              {error}
            </p>
          )}

          {preview && (
            <p className="mt-4 border border-line bg-paper px-4 py-3 text-sm text-muted">
              Parsed {preview.tradelineCount} tradelines from{" "}
              {preview.source === "pdf" ? "PDF" : "pasted text"} · confidence{" "}
              {(preview.confidence * 100).toFixed(0)}%
              {preview.warnings.length > 0 && (
                <> · warnings: {preview.warnings.join("; ")}</>
              )}
            </p>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy || !file}
              onClick={() => void parsePdf(false)}
              className="h-12 border border-ink px-6 text-sm font-semibold text-ink disabled:opacity-40"
            >
              Preview PDF parse
            </button>
            <button
              type="button"
              disabled={busy || !file}
              onClick={() => void parsePdf(true)}
              className="h-12 bg-ink px-6 text-sm font-semibold text-paper disabled:opacity-40"
            >
              {busy && file ? "Working…" : "Create case from PDF"}
            </button>
            <Link
              href="/operator"
              className="inline-flex h-12 items-center text-sm underline underline-offset-4"
            >
              Operator desk
            </Link>
          </div>

          <div className="mt-14 border-t border-line pt-8">
            <button
              type="button"
              onClick={() => setShowPaste((v) => !v)}
              className="flex w-full items-center justify-between gap-4 text-left"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brass">
                  Alternate
                </p>
                <p className="mt-1 font-display text-xl text-ink">
                  Paste report text instead
                </p>
                <p className="mt-1 text-sm text-muted">
                  Only if you don’t have a PDF — upload is preferred.
                </p>
              </div>
              <span className="text-sm font-semibold text-ink-soft">
                {showPaste ? "Hide" : "Show"}
              </span>
            </button>

            {showPaste && (
              <div className="mt-6 space-y-4">
                <textarea
                  className="min-h-56 w-full border border-line bg-paper p-4 font-mono text-xs leading-relaxed text-ink-soft"
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setPreview(null);
                  }}
                  placeholder="Paste plain-text report extract here…"
                />
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="h-10 border border-line px-4 text-sm text-ink"
                    onClick={() => {
                      setText(SAMPLE_TEXT);
                      setPreview(null);
                    }}
                  >
                    Load sample text
                  </button>
                  <button
                    type="button"
                    disabled={busy || !text.trim()}
                    onClick={() => void parseText(false)}
                    className="h-10 border border-ink px-4 text-sm font-semibold text-ink disabled:opacity-40"
                  >
                    Preview text parse
                  </button>
                  <button
                    type="button"
                    disabled={busy || !text.trim()}
                    onClick={() => void parseText(true)}
                    className="h-10 bg-ink-soft px-4 text-sm font-semibold text-paper disabled:opacity-40"
                  >
                    Create case from text
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
