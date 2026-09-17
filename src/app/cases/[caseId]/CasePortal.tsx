"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Packet = {
  id: string;
  recipientName: string;
  recipientType: string;
  status: string;
  trackingNumber?: string | null;
  mailedAt?: string | null;
  deliveredAt?: string | null;
  lintPassed: boolean;
};

type Item = {
  id: string;
  creditor: string;
  groundCode: string;
  status: string;
  confidence: number;
  statusReported: string;
  bureaus: string[];
};

type Bundle = {
  id: string;
  title: string;
  status: string;
  waveNumber: number;
  investigationDueAt?: string | null;
  investigationStartedAt?: string | null;
  consumer: { id: string; fullName: string };
  items: Item[];
  packets: Packet[];
  auditLogs: { id: string; action: string; createdAt: string }[];
};

function daysLeft(due?: string | null) {
  if (!due) return null;
  return Math.ceil((new Date(due).getTime() - Date.now()) / 86400000);
}

export function CasePortal({ caseId }: { caseId: string }) {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [notifications, setNotifications] = useState<
    { id: string; title: string; body: string; read: boolean; createdAt: string }[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [responseItemId, setResponseItemId] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/cases/${caseId}`);
    if (!res.ok) {
      setError("Case not found");
      return;
    }
    const data = await res.json();
    setBundle(data.case);
    setResponseItemId((prev) => prev || data.case.items[0]?.id || "");
    const n = await fetch(`/api/notifications/${data.case.consumer.id}`);
    if (n.ok) {
      const nd = await n.json();
      setNotifications(nd.notifications ?? []);
    }
  }, [caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const due = useMemo(() => daysLeft(bundle?.investigationDueAt), [bundle]);

  async function uploadEvidence() {
    if (!bundle) return;
    setBusy(true);
    try {
      await fetch(`/api/cases/${caseId}/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: "Payment statement — sample",
          kind: "statement",
          matchedAccountHint: bundle.items[0]?.creditor ?? "",
        }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function submitResponse() {
    if (!responseItemId || !responseText.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/outcomes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: responseItemId,
          responseText,
          actor: "consumer",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setResponseText("");
      setBundle(data.case);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (!bundle) {
    return (
      <div className="mx-auto max-w-4xl py-20 text-center text-muted">
        {error ?? "Loading case…"}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-signal">
          Consumer portal
        </p>
        <h1 className="mt-2 font-display text-4xl text-ink">{bundle.title}</h1>
        <p className="mt-2 text-sm text-muted">
          Status: {bundle.status.replaceAll("_", " ")} · Wave {bundle.waveNumber}
          {due !== null && (
            <>
              {" "}
              · Investigation{" "}
              {due < 0 ? (
                <span className="text-danger">overdue by {Math.abs(due)}d</span>
              ) : (
                <span className="text-signal">{due}d remaining</span>
              )}
            </>
          )}
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link href="/operator" className="underline underline-offset-4">
            Operator desk
          </Link>
          <Link href="/intake" className="underline underline-offset-4">
            Upload another report
          </Link>
        </div>
      </header>

      {error && (
        <div className="border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <section>
        <h2 className="font-display text-2xl text-ink">Mail tracking</h2>
        <ul className="mt-4 space-y-3">
          {bundle.packets.map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-2 border border-line bg-paper p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold text-ink">{p.recipientName}</p>
                <p className="text-sm text-muted">
                  {p.status}
                  {p.trackingNumber ? ` · ${p.trackingNumber}` : ""}
                  {p.mailedAt
                    ? ` · mailed ${new Date(p.mailedAt).toLocaleDateString()}`
                    : ""}
                  {p.deliveredAt
                    ? ` · delivered ${new Date(p.deliveredAt).toLocaleDateString()}`
                    : ""}
                </p>
              </div>
              <a
                href={`/api/packets/${p.id}/pdf`}
                className="inline-flex h-10 items-center justify-center bg-ink px-4 text-sm font-semibold text-paper"
              >
                Download PDF
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-display text-2xl text-ink">Dispute items</h2>
        <ul className="mt-4 space-y-3">
          {bundle.items.map((item) => (
            <li key={item.id} className="border border-line bg-paper p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-ink">{item.creditor}</p>
                <span className="font-mono text-[11px] text-brass">{item.groundCode}</span>
                <span className="text-xs text-muted">{item.status}</span>
              </div>
              <p className="mt-1 text-sm text-muted">
                {item.statusReported} · {item.bureaus.join(", ")} ·{" "}
                {(item.confidence * 100).toFixed(0)}%
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-2xl text-ink">Upload evidence</h2>
          <p className="mt-2 text-sm text-muted">
            Attach statements or ID docs. Matching boosts confidence for the next
            wave.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void uploadEvidence()}
            className="mt-4 h-11 bg-signal px-5 text-sm font-semibold text-paper disabled:opacity-40"
          >
            Attach sample statement
          </button>
        </div>
        <div>
          <h2 className="font-display text-2xl text-ink">Bureau response</h2>
          <p className="mt-2 text-sm text-muted">
            Paste a response letter — we classify deleted / corrected / verified /
            frivolous / reinserted.
          </p>
          <select
            className="mt-3 w-full border border-line bg-paper px-3 py-2 text-sm"
            value={responseItemId}
            onChange={(e) => setResponseItemId(e.target.value)}
          >
            {bundle.items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.creditor}
              </option>
            ))}
          </select>
          <textarea
            className="mt-2 min-h-28 w-full border border-line bg-paper p-3 text-sm"
            value={responseText}
            onChange={(e) => setResponseText(e.target.value)}
            placeholder="Paste CRA investigation results…"
          />
          <button
            type="button"
            disabled={busy || !responseText.trim()}
            onClick={() => void submitResponse()}
            className="mt-3 h-11 bg-ink px-5 text-sm font-semibold text-paper disabled:opacity-40"
          >
            Classify & record outcome
          </button>
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl text-ink">Notifications</h2>
        <ul className="mt-3 space-y-2">
          {notifications.length === 0 && (
            <li className="text-sm text-muted">No notifications yet.</li>
          )}
          {notifications.map((n) => (
            <li key={n.id} className="border-t border-line pt-2 text-sm">
              <span className="font-semibold text-ink">{n.title}</span>
              <p className="text-muted">{n.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
