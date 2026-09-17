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

type CoachItem = {
  itemId: string;
  creditor: string;
  groundCode: string;
  readyToMail: boolean;
  coachMessage: string;
  requirements: { kind: string; label: string; required: boolean; why: string }[];
  satisfied: { kind: string; label: string }[];
  missingRequired: { kind: string; label: string }[];
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
  evidenceCoach?: CoachItem[];
  mailBlocked?: boolean;
  mailBlockedMessages?: string[];
  conflicts?: {
    key: string;
    creditor: string;
    fields: { field: string; values: { bureau: string; value: string }[] }[];
  }[];
  reinsertionChecks?: {
    id: string;
    label: string;
    dueAt: string;
    status: string;
  }[];
  notifications?: {
    id: string;
    title: string;
    body: string;
    read: boolean;
    createdAt: string;
  }[];
};

const EVIDENCE_KINDS = [
  { kind: "id", label: "Government ID" },
  { kind: "address_proof", label: "Proof of address" },
  { kind: "statement", label: "Account statement" },
  { kind: "report_excerpt", label: "Report excerpt" },
  { kind: "ftc_identity_report", label: "FTC identity report" },
  { kind: "medical_eob", label: "Medical EOB" },
  { kind: "au_agreement", label: "AU agreement" },
];

function daysLeft(due?: string | null) {
  if (!due) return null;
  return Math.ceil((new Date(due).getTime() - Date.now()) / 86400000);
}

export function CasePortal({
  caseId,
  initialBundle = null,
}: {
  caseId: string;
  initialBundle?: Bundle | null;
}) {
  const [bundle, setBundle] = useState<Bundle | null>(
    initialBundle as Bundle | null,
  );
  const [notifications, setNotifications] = useState<
    { id: string; title: string; body: string; read: boolean; createdAt: string }[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [responseItemId, setResponseItemId] = useState("");
  const [responseFile, setResponseFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadKind, setUploadKind] = useState("statement");

  const load = useCallback(async () => {
    const res = await fetch(`/api/cases/${caseId}`);
    if (!res.ok) {
      setError("Case not found");
      return;
    }
    const data = await res.json();
    setBundle(data.case);
    setResponseItemId((prev) => prev || data.case.items[0]?.id || "");
    if (data.case.notifications?.length) {
      setNotifications(data.case.notifications);
    }
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
      const kindMeta = EVIDENCE_KINDS.find((k) => k.kind === uploadKind);
      await fetch(`/api/cases/${caseId}/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: kindMeta?.label ?? uploadKind,
          kind: uploadKind,
          matchedAccountHint: bundle.items[0]?.creditor ?? "",
          itemId: responseItemId || undefined,
        }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function submitResponse() {
    if (!responseItemId) return;
    if (!responseText.trim() && !responseFile) return;
    setBusy(true);
    try {
      let res: Response;
      if (responseFile) {
        const form = new FormData();
        form.set("itemId", responseItemId);
        form.set("actor", "consumer");
        form.set("file", responseFile);
        if (responseText.trim()) form.set("responseText", responseText);
        res = await fetch(`/api/cases/${caseId}/outcomes`, {
          method: "POST",
          body: form,
        });
      } else {
        res = await fetch(`/api/cases/${caseId}/outcomes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemId: responseItemId,
            responseText,
            actor: "consumer",
          }),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setResponseText("");
      setResponseFile(null);
      setBundle(data.case);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function markRead(id: string) {
    await fetch(`/api/notifications/${bundle?.consumer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
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
        {bundle.mailBlocked && (
          <p className="mt-3 border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            Mailing blocked until evidence is complete:{" "}
            {(bundle.mailBlockedMessages ?? []).join(" · ")}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link href="/operator" className="underline underline-offset-4">
            Operator desk
          </Link>
          <Link href="/intake" className="underline underline-offset-4">
            Upload another report
          </Link>
          <a
            href={`/api/cases/${caseId}/statement?pack=cfpb`}
            className="underline underline-offset-4"
          >
            Download CFPB pack
          </a>
        </div>
      </header>

      {error && (
        <div className="border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <section>
        <h2 className="font-display text-2xl text-ink">Notification center</h2>
        <ul className="mt-3 space-y-2">
          {notifications.length === 0 && (
            <li className="text-sm text-muted">No notifications yet.</li>
          )}
          {notifications.map((n) => (
            <li
              key={n.id}
              className={`border-t border-line pt-2 text-sm ${n.read ? "opacity-60" : ""}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className="font-semibold text-ink">{n.title}</span>
                  <p className="text-muted">{n.body}</p>
                  <p className="text-xs text-brass">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </div>
                {!n.read && (
                  <button
                    type="button"
                    className="text-xs font-semibold text-signal underline"
                    onClick={() => void markRead(n.id)}
                  >
                    Mark read
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

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
              <div className="flex flex-wrap gap-2">
                <a
                  href={`/api/packets/${p.id}/pdf`}
                  className="inline-flex h-10 items-center justify-center bg-ink px-4 text-sm font-semibold text-paper"
                >
                  Letter PDF
                </a>
                <a
                  href={`/api/packets/${p.id}/excerpt-pdf`}
                  className="inline-flex h-10 items-center justify-center border border-ink px-4 text-sm font-semibold text-ink"
                >
                  Annotated excerpt
                </a>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {(bundle.conflicts?.length ?? 0) > 0 && (
        <section>
          <h2 className="font-display text-2xl text-ink">Cross-bureau conflict radar</h2>
          <ul className="mt-3 space-y-2">
            {bundle.conflicts!.map((c) => (
              <li key={c.key} className="border border-line bg-mist/40 p-3 text-sm">
                <p className="font-semibold text-ink">{c.creditor}</p>
                {c.fields.map((f) => (
                  <p key={f.field} className="mt-1 text-muted">
                    {f.field}:{" "}
                    {f.values.map((v) => `${v.bureau}=${v.value}`).join(" · ")}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        </section>
      )}

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
              {item.status === "resolved_verified" && (
                <a
                  href={`/api/cases/${caseId}/statement?itemId=${item.id}&format=txt`}
                  className="mt-2 inline-block text-sm font-semibold text-signal underline"
                >
                  Download consumer statement
                </a>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-display text-2xl text-ink">Evidence coach</h2>
        <p className="mt-2 text-sm text-muted">
          Required documents per ground. Mailing stays blocked until these clear.
        </p>
        <ul className="mt-4 space-y-3">
          {(bundle.evidenceCoach ?? []).map((c) => (
            <li key={c.itemId} className="border border-line bg-paper p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-ink">{c.creditor}</p>
                <span className="font-mono text-[11px] text-brass">{c.groundCode}</span>
                <span
                  className={`text-xs font-semibold ${
                    c.readyToMail ? "text-signal" : "text-danger"
                  }`}
                >
                  {c.readyToMail ? "Ready" : "Needs evidence"}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted">{c.coachMessage}</p>
              <ul className="mt-2 space-y-1 text-sm">
                {c.requirements.map((r) => {
                  const ok = c.satisfied.some((s) => s.kind === r.kind);
                  return (
                    <li key={r.kind} className={ok ? "text-signal" : "text-ink-soft"}>
                      {ok ? "✓" : "○"} {r.label}
                      {r.required ? "" : " (optional)"} — {r.why}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
          {(bundle.evidenceCoach?.length ?? 0) === 0 && (
            <li className="text-sm text-muted">No items to coach yet.</li>
          )}
        </ul>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-muted">Document type</span>
            <select
              className="h-11 border border-line bg-paper px-3"
              value={uploadKind}
              onChange={(e) => setUploadKind(e.target.value)}
            >
              {EVIDENCE_KINDS.map((k) => (
                <option key={k.kind} value={k.kind}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void uploadEvidence()}
            className="h-11 bg-signal px-5 text-sm font-semibold text-paper disabled:opacity-40"
          >
            Attach evidence stub
          </button>
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl text-ink">Response letter inbox</h2>
        <p className="mt-2 text-sm text-muted">
          Paste investigation results or upload a response PDF. We classify the
          outcome and open an exception gate when human review is needed.
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
        <input
          type="file"
          accept=".pdf,.txt,application/pdf,text/plain"
          className="mt-2 block w-full text-sm"
          onChange={(e) => setResponseFile(e.target.files?.[0] ?? null)}
        />
        <textarea
          className="mt-2 min-h-28 w-full border border-line bg-paper p-3 text-sm"
          value={responseText}
          onChange={(e) => setResponseText(e.target.value)}
          placeholder="Paste CRA investigation results (or leave blank if uploading a readable PDF)…"
        />
        <button
          type="button"
          disabled={busy || (!responseText.trim() && !responseFile)}
          onClick={() => void submitResponse()}
          className="mt-3 h-11 bg-ink px-5 text-sm font-semibold text-paper disabled:opacity-40"
        >
          Classify & record outcome
        </button>
      </section>

      {(bundle.reinsertionChecks?.length ?? 0) > 0 && (
        <section>
          <h2 className="font-display text-2xl text-ink">Reinsertion checks</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {bundle.reinsertionChecks!.map((c) => (
              <li key={c.id} className="border-t border-line pt-2">
                {c.label} · {c.status} · due{" "}
                {new Date(c.dueAt).toLocaleDateString()}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
