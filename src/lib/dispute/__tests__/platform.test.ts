import { describe, expect, it } from "vitest";
import { evaluateAutoApprove } from "@/lib/dispute/auto-approve";
import { matchEvidenceToItems } from "@/lib/dispute/evidence";
import { findCrossBureauConflicts } from "@/lib/dispute/furnishers";
import {
  daysRemaining,
  investigationDueFromDelivery,
  investigationStatus,
} from "@/lib/dispute/investigation";
import { classifyResponseText } from "@/lib/dispute/outcomes";
import { parseCreditReportText } from "@/lib/dispute/parse-report";
import { renderLetterPdf } from "@/lib/dispute/pdf";
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
