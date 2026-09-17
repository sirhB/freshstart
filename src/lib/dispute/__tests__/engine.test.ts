import { describe, expect, it } from "vitest";
import { classifyTradelines } from "@/lib/dispute/classify";
import { buildCraLetter, buildDisputePacket, buildFurnisherLetter } from "@/lib/dispute/letters";
import { lintLetter } from "@/lib/dispute/lint";
import {
  SAMPLE_CONSUMER,
  SAMPLE_TRADELINES,
} from "@/lib/dispute/sample-data";

describe("classifyTradelines", () => {
  it("recommends actionable inaccuracies and skips accurate-looking negatives", () => {
    const items = classifyTradelines(SAMPLE_TRADELINES, {
      asOf: new Date("2026-09-17"),
    });

    const byCreditor = Object.fromEntries(items.map((i) => [i.creditor, i]));

    expect(byCreditor["Synchrony Bank / Midland Credit"].groundCode).toBe("NOT_MINE");
    expect(byCreditor["Synchrony Bank / Midland Credit"].recommended).toBe(true);

    expect(byCreditor["OneMain Financial"].groundCode).toBe("INACCURATE_STATUS");
    expect(byCreditor["Affirm"].groundCode).toBe("UNAUTHORIZED_INQUIRY");

    expect(byCreditor["Local Credit Union Auto"].recommended).toBe(false);
    expect(byCreditor["Local Credit Union Auto"].riskFlags).toContain("accurate_looking");
  });

  it("caps recommended wave size", () => {
    const items = classifyTradelines(SAMPLE_TRADELINES, {
      asOf: new Date("2026-09-17"),
      maxRecommended: 2,
    });
    expect(items.filter((i) => i.recommended)).toHaveLength(2);
  });
});

describe("CFPB letters", () => {
  const items = classifyTradelines(SAMPLE_TRADELINES, {
    asOf: new Date("2026-09-17"),
  }).filter((i) => i.recommended);

  it("builds CRA letters with identity, items, and enclosures", () => {
    const letter = buildCraLetter({
      consumer: SAMPLE_CONSUMER,
      bureau: "Experian",
      items,
      asOf: new Date("2026-09-17"),
    });

    expect(letter.body).toContain("Jordan Hale");
    expect(letter.body).toContain("Fair Credit Reporting Act");
    expect(letter.body).toContain("Experian");
    expect(letter.body).toContain("Explanation of inaccuracy:");
    expect(letter.body).toContain("Enclosures:");
    expect(letter.lintPassed).toBe(true);
  });

  it("builds furnisher letters", () => {
    const midland = items.filter((i) =>
      (i.furnisherName ?? "").includes("Midland"),
    );
    const letter = buildFurnisherLetter({
      consumer: SAMPLE_CONSUMER,
      items: midland,
      furnisherName: "Midland Credit Management",
      furnisherAddressLines: ["P.O. Box 603548", "San Diego, CA 92160"],
      asOf: new Date("2026-09-17"),
    });
    expect(letter.body).toContain("Direct dispute");
    expect(letter.body).toContain("Midland Credit Management");
    expect(letter.lintPassed).toBe(true);
  });

  it("builds a full dual-path packet", () => {
    const letters = buildDisputePacket({
      consumer: SAMPLE_CONSUMER,
      items,
      asOf: new Date("2026-09-17"),
    });
    expect(letters.some((l) => l.recipient.type === "cra")).toBe(true);
    expect(letters.some((l) => l.recipient.type === "furnisher")).toBe(true);
  });
});

describe("compliance linter", () => {
  it("blocks accurate-looking items and guarantee language", () => {
    const badItem = classifyTradelines(SAMPLE_TRADELINES, {
      asOf: new Date("2026-09-17"),
    }).find((i) => i.riskFlags.includes("accurate_looking"))!;

    const issues = lintLetter({
      consumer: SAMPLE_CONSUMER,
      items: [badItem],
      body: "We guarantee deletion of this account and a 100% removal.",
      enclosureList: [],
    });

    expect(issues.some((i) => i.code === "accurate_looking")).toBe(true);
    expect(issues.some((i) => i.code === "guarantee_language")).toBe(true);
  });
});
