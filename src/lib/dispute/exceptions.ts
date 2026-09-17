import { investigationStatus } from "@/lib/dispute/investigation";

export type ExceptionKind =
  | "outcome_exception"
  | "mail_exception"
  | "packet_signoff"
  | "dispute_plan"
  | "parse_review"
  | "compliance_hold"
  | "sla_overdue"
  | "sla_due_soon"
  | "evidence_blocked";

export type OperatorException = {
  id: string;
  caseId: string;
  caseTitle: string;
  consumerName: string;
  kind: ExceptionKind;
  priority: number;
  summary: string;
  createdAt: string;
};

const GATE_PRIORITY: Record<string, number> = {
  outcome_exception: 100,
  mail_exception: 95,
  compliance_hold: 90,
  parse_review: 80,
  packet_signoff: 50,
  dispute_plan: 40,
};

/** Rank operator work: outcome/mail exceptions and SLA first. */
export function buildExceptionInbox(input: {
  cases: {
    id: string;
    title: string;
    consumerName: string;
    investigationDueAt?: Date | string | null;
    approvals: { id: string; gateType: string; status: string; createdAt: Date | string }[];
    evidenceBlocked?: boolean;
  }[];
  now?: Date;
}): OperatorException[] {
  const now = input.now ?? new Date();
  const out: OperatorException[] = [];

  for (const c of input.cases) {
    for (const a of c.approvals.filter((x) => x.status === "pending")) {
      const kind = a.gateType as ExceptionKind;
      out.push({
        id: `gate:${a.id}`,
        caseId: c.id,
        caseTitle: c.title,
        consumerName: c.consumerName,
        kind,
        priority: GATE_PRIORITY[a.gateType] ?? 30,
        summary: `${a.gateType.replaceAll("_", " ")} needs decision`,
        createdAt: new Date(a.createdAt).toISOString(),
      });
    }

    if (c.investigationDueAt) {
      const due = new Date(c.investigationDueAt);
      const status = investigationStatus(due, now);
      if (status === "overdue") {
        out.push({
          id: `sla-overdue:${c.id}`,
          caseId: c.id,
          caseTitle: c.title,
          consumerName: c.consumerName,
          kind: "sla_overdue",
          priority: 98,
          summary: `Investigation overdue (due ${due.toLocaleDateString()})`,
          createdAt: due.toISOString(),
        });
      } else if (status === "due_soon") {
        out.push({
          id: `sla-soon:${c.id}`,
          caseId: c.id,
          caseTitle: c.title,
          consumerName: c.consumerName,
          kind: "sla_due_soon",
          priority: 70,
          summary: `Investigation due soon (${due.toLocaleDateString()})`,
          createdAt: due.toISOString(),
        });
      }
    }

    if (c.evidenceBlocked) {
      out.push({
        id: `evidence:${c.id}`,
        caseId: c.id,
        caseTitle: c.title,
        consumerName: c.consumerName,
        kind: "evidence_blocked",
        priority: 85,
        summary: "Required evidence missing — mail blocked",
        createdAt: now.toISOString(),
      });
    }
  }

  return out.sort((a, b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt));
}
