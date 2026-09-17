"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Bureau = "Equifax" | "Experian" | "TransUnion";

type CaseListItem = {
  id: string;
  title: string;
  status: string;
  waveNumber: number;
  updatedAt: string;
  consumer: { fullName: string };
  _count: { items: number; packets: number; approvals: number };
  approvals: { id: string; gateType: string }[];
};

type DisputeItem = {
  id: string;
  creditor: string;
  accountType: string;
  statusReported: string;
  balance?: string | null;
  groundCode: string;
  groundRationale: string;
  confidence: number;
  recommended: boolean;
  status: string;
  bureaus: Bureau[];
  evidenceNotes?: string | null;
};

type Packet = {
  id: string;
  recipientType: string;
  recipientName: string;
  bureau?: string | null;
  status: string;
  bodyText: string;
  lintPassed: boolean;
  lintIssues: { code: string; severity: string; message: string }[];
  trackingNumber?: string | null;
  mailedAt?: string | null;
  deliveredAt?: string | null;
};

type CaseBundle = {
  id: string;
  title: string;
  status: string;
  waveNumber?: number;
  investigationDueAt?: string | null;
  consumer: {
    id?: string;
    fullName: string;
    addressLine1: string;
    cityStateZip: string;
  };
  items: DisputeItem[];
  packets: Packet[];
  approvals: { id: string; gateType: string; status: string }[];
  auditLogs: { id: string; action: string; actor: string; createdAt: string }[];
};

export function OperatorConsole() {
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [bundle, setBundle] = useState<CaseBundle | null>(null);
  const [decisions, setDecisions] = useState<Record<string, "approved" | "denied">>({});
  const [activePacketId, setActivePacketId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCases = useCallback(async () => {
    const res = await fetch("/api/cases");
    const data = await res.json();
    setCases(data.cases ?? []);
    if (!activeId && data.cases?.[0]?.id) {
      setActiveId(data.cases[0].id);
    }
  }, [activeId]);

  const loadCase = useCallback(async (caseId: string) => {
    const res = await fetch(`/api/cases/${caseId}`);
    if (!res.ok) {
      setError("Failed to load case");
      return;
    }
    const data = await res.json();
    const next = data.case as CaseBundle;
    setBundle(next);
    setError(null);
    const initial: Record<string, "approved" | "denied"> = {};
    for (const item of next.items) {
      if (item.status === "approved" || item.status === "denied") {
        initial[item.id] = item.status;
      } else if (item.recommended) {
        initial[item.id] = "approved";
      } else {
        initial[item.id] = "denied";
      }
    }
    setDecisions(initial);
    setActivePacketId(next.packets[0]?.id ?? null);
  }, []);

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  useEffect(() => {
    if (activeId) void loadCase(activeId);
  }, [activeId, loadCase]);

  const activePacket = useMemo(
    () => bundle?.packets.find((p) => p.id === activePacketId) ?? null,
    [bundle, activePacketId],
  );

  async function submitPlan() {
    if (!bundle) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/cases/${bundle.id}/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actor: "operator",
          decisions: Object.entries(decisions).map(([itemId, decision]) => ({
            itemId,
            decision,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Plan failed");
      setBundle(data.case);
      setActivePacketId(data.case.packets[0]?.id ?? null);
      await loadCases();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Plan failed");
    } finally {
      setBusy(false);
    }
  }

  async function decidePacket(decision: "approved" | "denied") {
    if (!activePacket) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/packets/${activePacket.id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor: "operator", decision }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Decision failed");
      setBundle(data.case);
      await loadCases();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decision failed");
    } finally {
      setBusy(false);
    }
  }

  async function mailApproved() {
    if (!bundle) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/cases/${bundle.id}/mail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor: "operator" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Mail queue failed");
      setBundle(data.case);
      await loadCases();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mail queue failed");
    } finally {
      setBusy(false);
    }
  }

  async function postAction(path: string, body: Record<string, unknown> = {}) {
    if (!bundle) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor: "operator", ...body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      if (data.case) {
        setBundle(data.case);
        setActiveId(data.case.id);
        setActivePacketId(data.case.packets[0]?.id ?? null);
      }
      await loadCases();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[240px_1fr]">
      <aside className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-signal">
            Operator
          </p>
          <h1 className="mt-2 font-display text-3xl text-ink">Approval desk</h1>
          <p className="mt-2 text-sm text-muted">
            Approve plans and packets, run hands-free waves, track certified mail,
            and open the consumer portal.
          </p>
        </div>
        <ul className="space-y-2">
          {cases.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setActiveId(c.id)}
                className={`w-full border px-3 py-3 text-left transition ${
                  activeId === c.id
                    ? "border-ink bg-ink text-paper"
                    : "border-line bg-paper text-ink hover:border-ink/40"
                }`}
              >
                <p className="text-sm font-semibold">{c.consumer.fullName}</p>
                <p className={`mt-1 text-xs ${activeId === c.id ? "text-fog/80" : "text-muted"}`}>
                  {c.status.replaceAll("_", " ")} · {c.approvals.length} pending
                </p>
              </button>
            </li>
          ))}
          {cases.length === 0 && (
            <li className="border border-dashed border-line px-3 py-4 text-sm text-muted">
              No cases yet. Run <code className="text-ink">npm run db:seed</code>.
            </li>
          )}
        </ul>
        <div className="space-y-2 text-sm">
          <Link href="/intake" className="block text-ink-soft underline-offset-4 hover:underline">
            Report intake
          </Link>
          <Link href="/" className="block text-ink-soft underline-offset-4 hover:underline">
            ← Fresh Start home
          </Link>
        </div>
      </aside>

      <section className="min-w-0 space-y-8">
        {error && (
          <div className="border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        {!bundle && (
          <div className="border border-line bg-paper px-6 py-16 text-center text-muted">
            Select a case to review.
          </div>
        )}

        {bundle && (
          <>
            <header className="border-b border-line pb-6">
              <p className="text-xs uppercase tracking-[0.18em] text-brass">
                {bundle.status.replaceAll("_", " ")}
                {bundle.waveNumber ? ` · wave ${bundle.waveNumber}` : ""}
                {bundle.investigationDueAt
                  ? ` · due ${new Date(bundle.investigationDueAt).toLocaleDateString()}`
                  : ""}
              </p>
              <h2 className="mt-2 font-display text-4xl text-ink">{bundle.title}</h2>
              <p className="mt-2 text-sm text-muted">
                {bundle.consumer.fullName} · {bundle.consumer.addressLine1},{" "}
                {bundle.consumer.cityStateZip}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/cases/${bundle.id}`}
                  className="inline-flex h-10 items-center border border-line px-3 text-sm font-semibold text-ink"
                >
                  Consumer portal
                </Link>
                <button
                  type="button"
                  disabled={busy || bundle.status !== "pending_plan_approval"}
                  onClick={() =>
                    void postAction(`/api/cases/${bundle.id}/auto-approve`, {
                      overrideFirstWave: true,
                    })
                  }
                  className="h-10 bg-signal px-3 text-sm font-semibold text-paper disabled:opacity-40"
                >
                  Auto-approve plan
                </button>
                <button
                  type="button"
                  disabled={busy || bundle.status !== "pending_plan_approval"}
                  onClick={() =>
                    void postAction(`/api/cases/${bundle.id}/hands-free`, {
                      overrideFirstWave: true,
                    })
                  }
                  className="h-10 border border-signal px-3 text-sm font-semibold text-signal disabled:opacity-40"
                >
                  Hands-free (approve → mail → deliver)
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void postAction(`/api/cases/${bundle.id}/next-wave`)}
                  className="h-10 border border-ink px-3 text-sm font-semibold text-ink disabled:opacity-40"
                >
                  Open next wave
                </button>
              </div>
            </header>

            <div>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="font-display text-2xl text-ink">Dispute plan</h3>
                  <p className="mt-1 text-sm text-muted">
                    Recommended items are pre-selected. Deny anything that looks
                    accurate-but-negative.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy || bundle.status !== "pending_plan_approval"}
                  onClick={() => void submitPlan()}
                  className="h-11 bg-ink px-5 text-sm font-semibold text-paper disabled:opacity-40"
                >
                  {bundle.status === "pending_plan_approval"
                    ? "Approve plan & rebuild letters"
                    : "Plan already decided"}
                </button>
              </div>

              <ul className="space-y-3">
                {bundle.items.map((item) => (
                  <li
                    key={item.id}
                    className="grid gap-4 border border-line bg-paper p-4 md:grid-cols-[1fr_auto]"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-ink">{item.creditor}</p>
                        <span className="font-mono text-[11px] uppercase tracking-wide text-brass">
                          {item.groundCode}
                        </span>
                        <span className="text-xs text-muted">
                          {(item.confidence * 100).toFixed(0)}% confidence
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        {item.accountType} · {item.statusReported}
                        {item.balance ? ` · ${item.balance}` : ""} ·{" "}
                        {item.bureaus.join(", ")}
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                        {item.groundRationale}
                      </p>
                      {item.evidenceNotes && (
                        <p className="mt-2 text-xs text-muted">
                          Evidence: {item.evidenceNotes}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 md:flex-col">
                      {(["approved", "denied"] as const).map((d) => (
                        <button
                          key={d}
                          type="button"
                          disabled={bundle.status !== "pending_plan_approval"}
                          onClick={() =>
                            setDecisions((prev) => ({ ...prev, [item.id]: d }))
                          }
                          className={`h-10 min-w-28 px-3 text-sm font-semibold capitalize ${
                            decisions[item.id] === d
                              ? d === "approved"
                                ? "bg-signal text-paper"
                                : "bg-danger text-paper"
                              : "border border-line text-ink"
                          }`}
                        >
                          {d === "approved" ? "Approve" : "Deny"}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="font-display text-2xl text-ink">Letter packets</h3>
                  <p className="mt-1 text-sm text-muted">
                    CFPB-structured CRA and furnisher letters. Lint must pass to
                    approve.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={
                      busy ||
                      !bundle.packets.some((p) => p.status === "approved")
                    }
                    onClick={() => void mailApproved()}
                    className="h-11 border border-ink px-5 text-sm font-semibold text-ink disabled:opacity-40"
                  >
                    Queue certified mail
                  </button>
                  <button
                    type="button"
                    disabled={
                      busy || !bundle.packets.some((p) => p.status === "mailed")
                    }
                    onClick={() => void postAction(`/api/cases/${bundle.id}/deliver`)}
                    className="h-11 bg-ink px-5 text-sm font-semibold text-paper disabled:opacity-40"
                  >
                    Mark delivered + start clock
                  </button>
                </div>
              </div>

              <div className="mb-4 flex flex-wrap gap-2">
                {bundle.packets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setActivePacketId(p.id)}
                    className={`h-10 px-3 text-sm ${
                      activePacketId === p.id
                        ? "bg-ink text-paper"
                        : "border border-line text-ink"
                    }`}
                  >
                    {p.recipientName}
                    <span className="ml-2 opacity-70">{p.status}</span>
                  </button>
                ))}
              </div>

              {activePacket && (
                <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
                  <article className="letter-sheet max-h-[36rem] overflow-auto p-6 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-ink-soft sm:p-8">
                    {activePacket.bodyText}
                  </article>
                  <div className="space-y-4">
                    <div className="border border-line bg-mist/60 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                        Compliance lint
                      </p>
                      <p
                        className={`mt-2 text-sm font-semibold ${
                          activePacket.lintPassed ? "text-signal" : "text-danger"
                        }`}
                      >
                        {activePacket.lintPassed ? "Passed" : "Blocked"}
                      </p>
                      <ul className="mt-3 space-y-2">
                        {activePacket.lintIssues.length === 0 && (
                          <li className="text-sm text-muted">No issues</li>
                        )}
                        {activePacket.lintIssues.map((issue) => (
                          <li key={issue.code + issue.message} className="text-sm text-ink-soft">
                            <span className="font-mono text-[11px] text-brass">
                              {issue.severity}
                            </span>{" "}
                            {issue.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={`/api/packets/${activePacket.id}/pdf`}
                        className="inline-flex h-11 flex-1 items-center justify-center border border-line px-3 text-sm font-semibold text-ink"
                      >
                        PDF
                      </a>
                      <button
                        type="button"
                        disabled={
                          busy ||
                          activePacket.status !== "pending_approval" ||
                          !activePacket.lintPassed
                        }
                        onClick={() => void decidePacket("approved")}
                        className="h-11 flex-1 bg-signal px-3 text-sm font-semibold text-paper disabled:opacity-40"
                      >
                        Approve packet
                      </button>
                      <button
                        type="button"
                        disabled={busy || activePacket.status !== "pending_approval"}
                        onClick={() => void decidePacket("denied")}
                        className="h-11 flex-1 border border-danger px-3 text-sm font-semibold text-danger disabled:opacity-40"
                      >
                        Deny
                      </button>
                    </div>
                    {(activePacket.trackingNumber || activePacket.mailedAt) && (
                      <p className="text-xs text-muted">
                        Tracking: {activePacket.trackingNumber ?? "—"}
                        {activePacket.mailedAt
                          ? ` · mailed ${new Date(activePacket.mailedAt).toLocaleString()}`
                          : ""}
                        {activePacket.deliveredAt
                          ? ` · delivered ${new Date(activePacket.deliveredAt).toLocaleString()}`
                          : ""}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div>
              <h3 className="font-display text-2xl text-ink">Audit log</h3>
              <ul className="mt-3 space-y-2">
                {bundle.auditLogs.map((log) => (
                  <li key={log.id} className="border-t border-line pt-2 text-sm text-muted">
                    <span className="font-mono text-xs text-brass">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>{" "}
                    {log.actor}: {log.action}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
