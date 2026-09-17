import { describe, expect, it } from "vitest";
import { evaluateAutoApprove, canAutoApprovePacket } from "@/lib/dispute/auto-approve";
import { matchEvidenceToItems } from "@/lib/dispute/evidence";
import {
  buildEvidenceCoach,
  mailBlockedByEvidence,
  requiredEvidenceForGround,
} from "@/lib/dispute/evidence-coach";
import { findCrossBureauConflicts } from "@/lib/dispute/furnishers";
import {
  daysRemaining,
  investigationDueFromDelivery,
  investigationStatus,
} from "@/lib/dispute/investigation";
import { classifyResponseText } from "@/lib/dispute/outcomes";
import { parseCreditReportText } from "@/lib/dispute/parse-report";
import { renderLetterPdf } from "@/lib/dispute/pdf";
import { renderAnnotatedExcerptPdf } from "@/lib/dispute/annotate";
import { rankDisputeItems, suggestWave } from "@/lib/dispute/impact";
import { buildExceptionInbox } from "@/lib/dispute/exceptions";
import { aggregateOutcomeInsights } from "@/lib/dispute/insights";
import {
  buildConsumerStatement,
  buildCfpbComplaintPack,
} from "@/lib/dispute/statements";
import { lintLetter } from "@/lib/dispute/lint";
import { detectReinsertions } from "@/lib/workflow";
import { classifyTradelines } from "@/lib/dispute/classify";
import { SAMPLE_TRADELINES } from "@/lib/dispute/sample-data";

describe("auto-approve policy", () => {
  it("blocks first wave by default", () => {
    const items = classifyTradelines(SAMPLE_TRADELINES, {
      asOf: new Date("2026-09-17"),
    }).filter((i) => i.recommended);
    const decisions = evaluateAutoApprove(items, { waveNumber: 1 });
    expect(decisions.every((d) => !d.autoApprove)).toBe(true);
  });

  it("allows high-confidence allowed grounds on later waves", () => {
    const items = classifyTradelines(SAMPLE_TRADELINES, {
      asOf: new Date("2026-09-17"),
    })
      .filter((i) => i.groundCode === "NOT_MINE")
      .map((i) => ({
        ...i,
        confidence: 0.92,
        riskFlags: [] as string[],
        recommended: true,
      }));
    const decisions = evaluateAutoApprove(items, { waveNumber: 2 });
    expect(decisions[0]?.autoApprove).toBe(true);
  });

  it("blocks packet auto-approve when evidence missing", () => {
    const items = classifyTradelines(SAMPLE_TRADELINES, {
      asOf: new Date("2026-09-17"),
    }).filter((i) => i.groundCode === "OUTDATED");
    const gate = canAutoApprovePacket({
      lintPassed: true,
      items: items.map((i) => ({
        ...i,
        confidence: 0.95,
        riskFlags: [],
        recommended: true,
      })),
      waveNumber: 2,
      evidenceBlocked: true,
      evidenceMessages: ["Missing report excerpt"],
    });
    expect(gate.ok).toBe(false);
  });
});

describe("evidence coach", () => {
  it("lists required evidence per ground", () => {
    const reqs = requiredEvidenceForGround("NOT_MINE");
    expect(reqs.some((r) => r.kind === "id" && r.required)).toBe(true);
  });

  it("blocks mail when required evidence missing", () => {
    const items = classifyTradelines(SAMPLE_TRADELINES, {
      asOf: new Date("2026-09-17"),
    }).filter((i) => i.recommended);
    const coach = buildEvidenceCoach(items, []);
    const gate = mailBlockedByEvidence(coach);
    expect(gate.blocked).toBe(true);
    expect(gate.messages.length).toBeGreaterThan(0);
  });

  it("clears mail gate when report excerpt + identity docs attached", () => {
    const items = classifyTradelines(SAMPLE_TRADELINES, {
      asOf: new Date("2026-09-17"),
    }).filter((i) => i.groundCode === "NOT_MINE");
    const coach = buildEvidenceCoach(items, [
      { id: "1", label: "ID", kind: "id" },
      { id: "2", label: "Address", kind: "address_proof" },
      { id: "3", label: "Excerpt", kind: "report_excerpt" },
    ]);
    expect(mailBlockedByEvidence(coach).blocked).toBe(false);
  });

  it("emits lint error for missing required evidence", () => {
    const items = classifyTradelines(SAMPLE_TRADELINES, {
      asOf: new Date("2026-09-17"),
    }).filter((i) => i.recommended).slice(0, 1);
    const coach = buildEvidenceCoach(items, []);
    const issues = lintLetter({
      consumer: {
        fullName: "Jordan Hale",
        addressLine1: "1 Main",
        cityStateZip: "Austin, TX 78701",
      },
      items,
      body: "Fair Credit Reporting Act 15 U.S.C. §1681 dispute letter.",
      enclosureList: ["ID"],
      evidenceCoach: coach,
    });
    expect(issues.some((i) => i.code === "missing_required_evidence" && i.severity === "error")).toBe(
      true,
    );
  });
});

describe("impact ranking + exceptions + insights", () => {
  it("ranks and suggests a wave", () => {
    const items = classifyTradelines(SAMPLE_TRADELINES, {
      asOf: new Date("2026-09-17"),
    });
    const ranked = rankDisputeItems(items);
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[ranked.length - 1].score);
    const wave = suggestWave(ranked, 3);
    expect(wave.length).toBeLessThanOrEqual(3);
  });

  it("builds exception inbox with SLA overdue first", () => {
    const inbox = buildExceptionInbox({
      cases: [
        {
          id: "c1",
          title: "Wave 1",
          consumerName: "A",
          investigationDueAt: new Date("2026-01-01"),
          approvals: [],
        },
        {
          id: "c2",
          title: "Wave 2",
          consumerName: "B",
          approvals: [
            {
              id: "g1",
              gateType: "dispute_plan",
              status: "pending",
              createdAt: new Date(),
            },
          ],
        },
      ],
      now: new Date("2026-09-17"),
    });
    expect(inbox[0].kind).toBe("sla_overdue");
  });

  it("aggregates outcome win rates", () => {
    const { byGround } = aggregateOutcomeInsights([
      { outcome: "deleted", item: { groundCode: "NOT_MINE", creditor: "X" } },
      { outcome: "verified", item: { groundCode: "NOT_MINE", creditor: "X" } },
      { outcome: "corrected", item: { groundCode: "OUTDATED", creditor: "Y" } },
    ]);
    const notMine = byGround.find((r) => r.groundCode === "NOT_MINE");
    expect(notMine?.winRate).toBe(0.5);
  });
});

describe("statements + annotated pdf", () => {
  it("builds consumer statement and cfpb pack", () => {
    const items = classifyTradelines(SAMPLE_TRADELINES, {
      asOf: new Date("2026-09-17"),
    });
    const statement = buildConsumerStatement({
      consumer: {
        fullName: "Jordan Hale",
        addressLine1: "1 Main",
        cityStateZip: "Austin, TX 78701",
      },
      item: items[0],
      asOf: new Date("2026-09-17"),
    });
    expect(statement).toMatch(/Fair Credit Reporting Act/);
    const pack = buildCfpbComplaintPack({
      consumer: {
        fullName: "Jordan Hale",
        addressLine1: "1 Main",
        cityStateZip: "Austin, TX 78701",
      },
      caseTitle: "Wave 1",
      caseId: "case1",
      items: items.slice(0, 2),
      timeline: [{ at: "2026-09-01", action: "mailed" }],
      asOf: new Date("2026-09-17"),
    });
    expect(pack).toMatch(/CFPB COMPLAINT/);
  });

  it("renders annotated excerpt PDF", async () => {
    const items = classifyTradelines(SAMPLE_TRADELINES, {
      asOf: new Date("2026-09-17"),
    }).slice(0, 2);
    const pdf = await renderAnnotatedExcerptPdf({
      consumer: {
        fullName: "Jordan Hale",
        addressLine1: "1 Main",
        cityStateZip: "Austin, TX 78701",
      },
      items,
    });
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });
});

describe("parseCreditReportText", () => {
  it("extracts account blocks", () => {
    const parsed = parseCreditReportText(`
Report date: September 12, 2026
Equifax Experian
Account: Midland Credit
Account number: ****4412
Type: Collection
Status: Open collection
Balance: $1,204
Opened: 11/2020
Notes: not mine
`);
    expect(parsed.tradelines.length).toBeGreaterThanOrEqual(1);
    expect(parsed.tradelines[0].creditor).toMatch(/Midland/i);
    expect(parsed.tradelines[0].signals?.notMine).toBe(true);
  });

  it("ignores TransUnion Account Details / status boilerplate", () => {
    const parsed = parseCreditReportText(`
TransUnion Credit Report
Report date: September 12, 2026

Account: Details
Account number: ****0000
Status: Unknown

Account: Information
Balance: $0
Status: Current

Account: status
Status: of an ongoing dispute with TransUnion.

Account: closed by credit grantor
Status: Closed
Type: Account

Account: information disputed by consumer
Status: Disputed

Account: Midland Credit Management
Account number: ****4412
Type: Collection
Status: Open collection
Balance: $1,204
Opened: 11/2020
Notes: not mine
`);
    expect(parsed.tradelines.map((t) => t.creditor)).toEqual([
      "Midland Credit Management",
    ]);
    expect(parsed.warnings.some((w) => /boilerplate/i.test(w))).toBe(true);
  });
});

describe("outcomes + reinsertion", () => {
  it("classifies deletion language", () => {
    expect(
      classifyResponseText("The information has been deleted from your file.").outcome,
    ).toBe("deleted");
  });

  it("detects reinserted tradelines", () => {
    const hits = detectReinsertions({
      previouslyDeleted: [{ creditor: "Midland Credit Management", accountNumber: "****4412" }],
      currentTradelines: [
        {
          id: "x",
          creditor: "Midland Credit Management",
          accountNumber: "****4412",
          accountType: "Collection",
          status: "Open",
          bureaus: ["Experian"],
        },
      ],
    });
    expect(hits).toHaveLength(1);
  });
});

describe("evidence + cross-bureau", () => {
  it("matches statements to inaccurate status items", () => {
    const items = classifyTradelines(SAMPLE_TRADELINES, {
      asOf: new Date("2026-09-17"),
    }).filter((i) => i.groundCode === "INACCURATE_STATUS");
    const matches = matchEvidenceToItems(items, [
      {
        id: "e1",
        label: "OneMain payment statement",
        kind: "statement",
        matchedAccountHint: "2207",
      },
    ]);
    expect(matches[0].score).toBeGreaterThan(0.3);
  });

  it("finds status conflicts across bureaus", () => {
    const conflicts = findCrossBureauConflicts([
      {
        creditor: "Capital One",
        accountNumber: "8891",
        status: "Charge-off",
        balance: "$2841",
        bureau: "Equifax",
      },
      {
        creditor: "Capital One",
        accountNumber: "8891",
        status: "120 days late",
        balance: "$2841",
        bureau: "Experian",
      },
    ]);
    expect(conflicts.length).toBe(1);
  });

  it("does not flag same-bureau duplicates as cross-bureau conflicts", () => {
    const conflicts = findCrossBureauConflicts([
      {
        creditor: "Information",
        status: "Paid",
        bureau: "TransUnion",
      },
      {
        creditor: "Information",
        status: "Current",
        bureau: "TransUnion",
      },
    ]);
    expect(conflicts).toHaveLength(0);
  });
});

describe("investigation + pdf", () => {
  it("computes due dates and status", () => {
    const delivered = new Date("2026-09-01T00:00:00Z");
    const due = investigationDueFromDelivery(delivered);
    expect(daysRemaining(due, new Date("2026-09-10T00:00:00Z"))).toBe(21);
    expect(investigationStatus(due, new Date("2026-10-05T00:00:00Z"))).toBe(
      "overdue",
    );
  });

  it("renders a PDF buffer", async () => {
    const pdf = await renderLetterPdf({
      recipientName: "Equifax",
      recipientType: "cra",
      bodyText: "Jordan Hale\n\nTest dispute letter body.",
      trackingNumber: "9400123456789012345678",
      mailedAt: new Date("2026-09-17"),
    });
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });
});
