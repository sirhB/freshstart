import { GROUND_CATALOG } from "@/lib/domain/grounds";
import type {
  ClassifiedDisputeItem,
  GroundCode,
  TradelineInput,
} from "@/lib/domain/types";

const FCRA_NEGATIVE_YEARS = 7;

function parseLooseDate(value?: string): Date | null {
  if (!value) return null;
  // Accept MM/YYYY, YYYY-MM-DD, Month DD, YYYY, etc.
  const mmyyyy = value.match(/^(\d{1,2})\/(\d{4})$/);
  if (mmyyyy) {
    return new Date(Number(mmyyyy[2]), Number(mmyyyy[1]) - 1, 1);
  }
  const iso = Date.parse(value);
  if (!Number.isNaN(iso)) return new Date(iso);
  return null;
}

function yearsBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
}

function parseBalanceAmount(balance?: string): number | null {
  if (!balance || balance.trim() === "—" || balance.trim() === "-") return null;
  const n = Number(balance.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

type Classification = {
  groundCode: GroundCode;
  rationale: string;
  confidence: number;
  recommended: boolean;
  riskFlags: string[];
  evidenceNotes?: string;
};

function classifyOne(
  item: TradelineInput,
  asOf: Date,
  all: TradelineInput[],
): Classification {
  const signals = item.signals ?? {};
  const riskFlags: string[] = [];

  if (signals.notMine || signals.identityMismatch) {
    return {
      groundCode: signals.identityMismatch ? "MIXED_FILE" : "NOT_MINE",
      rationale: signals.identityMismatch
        ? `Identifying information associated with ${item.creditor} appears inconsistent with the consumer's file, suggesting a mixed-file or identity issue.`
        : `This ${item.accountType.toLowerCase()} reported by ${item.creditor} is not recognized as belonging to the consumer.`,
      confidence: signals.hasSupportingEvidence ? 0.92 : 0.78,
      recommended: true,
      riskFlags: signals.hasSupportingEvidence ? [] : ["needs_identity_evidence"],
      evidenceNotes: "Government ID, proof of address, and FTC Identity Theft Report if applicable.",
    };
  }

  if (signals.unauthorizedInquiry || /inquiry/i.test(item.accountType)) {
    if (signals.unauthorizedInquiry) {
      return {
        groundCode: "UNAUTHORIZED_INQUIRY",
        rationale: `Hard inquiry by ${item.creditor} appears unauthorized / without a shown permissible purpose.`,
        confidence: 0.8,
        recommended: true,
        riskFlags: [],
        evidenceNotes: "Any denial of application records or prior freeze documentation.",
      };
    }
  }

  if (signals.duplicateOfId) {
    const other = all.find((t) => t.id === signals.duplicateOfId);
    return {
      groundCode: "DUPLICATE",
      rationale: `Appears to duplicate ${other?.creditor ?? "another tradeline"} for the same obligation.`,
      confidence: 0.88,
      recommended: true,
      riskFlags: [],
    };
  }

  if (signals.authorizedUserOnly) {
    return {
      groundCode: "AUTHORIZED_USER_ONLY",
      rationale: `Consumer was an authorized user only; reporting as a primary obligor on ${item.creditor} is inaccurate.`,
      confidence: 0.84,
      recommended: true,
      riskFlags: [],
      evidenceNotes: "Cardmember agreement or AU documentation.",
    };
  }

  const dofd =
    parseLooseDate(item.dateOfFirstDelinquency) ?? parseLooseDate(item.dateOpened);
  if (dofd && yearsBetween(dofd, asOf) > FCRA_NEGATIVE_YEARS) {
    return {
      groundCode: "OUTDATED",
      rationale: `Negative information related to ${item.creditor} appears to exceed the general ${FCRA_NEGATIVE_YEARS}-year FCRA reporting period based on date ${item.dateOfFirstDelinquency ?? item.dateOpened}.`,
      confidence: 0.9,
      recommended: true,
      riskFlags: [],
    };
  }

  if (signals.paymentRecordsConflict) {
    return {
      groundCode: "INACCURATE_STATUS",
      rationale: `Payment history / late status reported for ${item.creditor} conflicts with the consumer's payment records.`,
      confidence: signals.hasSupportingEvidence ? 0.9 : 0.74,
      recommended: true,
      riskFlags: signals.hasSupportingEvidence ? [] : ["needs_payment_evidence"],
      evidenceNotes: "Account statements, payment confirmations, or payoff letter.",
    };
  }

  if (signals.missingMetro2Fields || (item.bureaus.length >= 2 && /incomplet|inconsist/i.test(item.rawNotes ?? ""))) {
    return {
      groundCode: "INCOMPLETE",
      rationale: `Reporting for ${item.creditor} appears incomplete or inconsistent across bureaus (Metro 2 / field completeness).`,
      confidence: 0.76,
      recommended: true,
      riskFlags: ["cross_bureau_review"],
    };
  }

  if (/medical/i.test(item.accountType) || /medical/i.test(item.creditor)) {
    const bal = parseBalanceAmount(item.balance);
    if (signals.medicalUnderThreshold || (bal !== null && bal < 500)) {
      return {
        groundCode: "MEDICAL_SPECIAL",
        rationale: `Medical collection from ${item.creditor} may be improperly reported or unverified under current medical-debt reporting practices.`,
        confidence: 0.7,
        recommended: Boolean(signals.medicalUnderThreshold),
        riskFlags: ["medical_edge_case", "requires_human_review"],
        evidenceNotes: "Itemized bill, insurance EOB, or payment proof.",
      };
    }
  }

  if (signals.hasSupportingEvidence) {
    return {
      groundCode: "UNVERIFIABLE",
      rationale: `Consumer requests a reasonable investigation of ${item.creditor}; information should be corrected or deleted if it cannot be verified as accurate, complete, and timely.`,
      confidence: 0.72,
      recommended: true,
      riskFlags: [],
      evidenceNotes: "Attach supporting documentation listed in the packet.",
    };
  }

  // Accurate-looking negative — do not recommend auto-dispute
  riskFlags.push("accurate_looking", "no_actionable_inaccuracy");
  return {
    groundCode: "UNVERIFIABLE",
    rationale: `Reported as negative (${item.status}) but no clear inaccuracy signal was detected. Manual review required before any dispute.`,
    confidence: 0.35,
    recommended: false,
    riskFlags,
  };
}

export function classifyTradelines(
  tradelines: TradelineInput[],
  options?: { asOf?: Date; maxRecommended?: number },
): ClassifiedDisputeItem[] {
  const asOf = options?.asOf ?? new Date();
  const maxRecommended = options?.maxRecommended ?? 5;

  const classified = tradelines.map((t) => {
    const result = classifyOne(t, asOf, tradelines);
    const catalog = GROUND_CATALOG[result.groundCode];
    return {
      id: `di_${t.id}`,
      tradelineId: t.id,
      creditor: t.creditor,
      accountNumber: t.accountNumber,
      accountType: t.accountType,
      statusReported: t.status,
      balance: t.balance,
      dateOpened: t.dateOpened,
      furnisherName: t.furnisherName ?? t.creditor,
      furnisherAddress: t.furnisherAddress,
      bureaus: t.bureaus,
      groundCode: result.groundCode,
      groundRationale: result.rationale,
      remedy: catalog.defaultRemedy,
      confidence: result.confidence,
      recommended: result.recommended,
      evidenceNotes: result.evidenceNotes,
      riskFlags: result.riskFlags,
    } satisfies ClassifiedDisputeItem;
  });

  // Cap auto-recommended wave size by confidence
  const recommended = classified
    .filter((c) => c.recommended)
    .sort((a, b) => b.confidence - a.confidence);

  const keep = new Set(recommended.slice(0, maxRecommended).map((c) => c.id));

  return classified.map((c) =>
    c.recommended && !keep.has(c.id)
      ? { ...c, recommended: false, riskFlags: [...c.riskFlags, "deferred_to_next_wave"] }
      : c,
  );
}
