"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

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

export default function IntakePage() {
  const router = useRouter();
  const [text, setText] = useState(SAMPLE_TEXT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    tradelineCount: number;
    warnings: string[];
    confidence: number;
  } | null>(null);

  async function parseOnly() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Parse failed");
      setPreview({
        tradelineCount: data.parsed.tradelines.length,
        warnings: data.parsed.warnings,
        confidence: data.parsed.confidence,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Parse failed");
    } finally {
      setBusy(false);
    }
  }

  async function createCase() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          createCase: true,
          consumer: {
            fullName: "Jordan Hale",
            addressLine1: "1842 Meridian Avenue",
            cityStateZip: "Austin, TX 78702",
            dateOfBirth: "04/12/1991",
            phone: "(512) 555-0148",
            reportFileNumber: "FS-2026-0912-JH",
            ssnLast4: "4281",
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Create failed");
      router.push(`/cases/${data.case.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
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
          <h1 className="mt-2 font-display text-4xl text-ink">
            Paste or parse a credit report
          </h1>
          <p className="mt-3 text-sm text-muted">
            Phase 3 parser extracts tradelines from text (and PDF uploads via
            API). Create a dispute case when the parse looks right.
          </p>

          <textarea
            className="mt-8 min-h-80 w-full border border-line bg-paper p-4 font-mono text-xs leading-relaxed text-ink-soft"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          {error && (
            <p className="mt-3 text-sm text-danger">{error}</p>
          )}
          {preview && (
            <p className="mt-3 text-sm text-muted">
              Parsed {preview.tradelineCount} tradelines · confidence{" "}
              {(preview.confidence * 100).toFixed(0)}%
              {preview.warnings.length > 0 && (
                <> · warnings: {preview.warnings.join("; ")}</>
              )}
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void parseOnly()}
              className="h-11 border border-ink px-5 text-sm font-semibold text-ink disabled:opacity-40"
            >
              Preview parse
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void createCase()}
              className="h-11 bg-ink px-5 text-sm font-semibold text-paper disabled:opacity-40"
            >
              Create dispute case
            </button>
            <Link
              href="/operator"
              className="inline-flex h-11 items-center text-sm underline underline-offset-4"
            >
              Operator desk
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
