import type { Bureau, ClassifiedDisputeItem } from "@/lib/domain/types";
import { classifyTradelines } from "@/lib/dispute/classify";
import { buildCraLetter } from "@/lib/dispute/letters";
import {
  SAMPLE_CONSUMER,
  SAMPLE_REPORT_DATE,
  SAMPLE_SCORES,
  SAMPLE_TRADELINES,
} from "@/lib/dispute/sample-data";

export type { Bureau };

export type NegativeItem = {
  id: string;
  creditor: string;
  accountType: string;
  status: string;
  balance: string;
  opened: string;
  bureaus: Bureau[];
  disputeGround: string;
  groundCode: string;
  confidence: number;
  recommended: boolean;
  evidenceNotes?: string;
};

export type DemoClient = {
  id: string;
  name: string;
  address: string;
  cityStateZip: string;
  reportDate: string;
  scores: { bureau: Bureau; score: number }[];
};

export const DEMO_CLIENT: DemoClient = {
  id: "cli_jordan",
  name: SAMPLE_CONSUMER.fullName,
  address: SAMPLE_CONSUMER.addressLine1,
  cityStateZip: SAMPLE_CONSUMER.cityStateZip,
  reportDate: SAMPLE_REPORT_DATE,
  scores: SAMPLE_SCORES,
};

const classified = classifyTradelines(SAMPLE_TRADELINES, {
  asOf: new Date("2026-09-17"),
  maxRecommended: 5,
});

export const NEGATIVE_ITEMS: NegativeItem[] = classified.map((item) => ({
  id: item.id,
  creditor: item.creditor,
  accountType: item.accountType,
  status: item.statusReported,
  balance: item.balance ?? "—",
  opened: item.dateOpened ?? "—",
  bureaus: item.bureaus,
  disputeGround: item.groundRationale,
  groundCode: item.groundCode,
  confidence: item.confidence,
  recommended: item.recommended,
  evidenceNotes: item.evidenceNotes,
}));

function toClassified(items: NegativeItem[]): ClassifiedDisputeItem[] {
  return items.map((item) => {
    const source = classified.find((c) => c.id === item.id)!;
    return source;
  });
}

export function buildLetter(
  client: DemoClient,
  bureau: Bureau,
  items: NegativeItem[],
): string {
  const letter = buildCraLetter({
    consumer: {
      fullName: client.name,
      addressLine1: client.address,
      cityStateZip: client.cityStateZip,
      dateOfBirth: SAMPLE_CONSUMER.dateOfBirth,
      phone: SAMPLE_CONSUMER.phone,
      reportFileNumber: SAMPLE_CONSUMER.reportFileNumber,
      ssnLast4: SAMPLE_CONSUMER.ssnLast4,
    },
    bureau,
    items: toClassified(items),
    asOf: new Date("2026-09-17"),
  });

  const lintNote = letter.lintPassed
    ? "Compliance lint: PASSED"
    : `Compliance lint: BLOCKED — ${letter.lintIssues
        .filter((i) => i.severity === "error")
        .map((i) => i.message)
        .join("; ")}`;

  return `${letter.body}

— Fresh Start · CFPB-structured sample · Not legal advice —
${lintNote}
`;
}
