import type { ClassifiedDisputeItem, GroundCode } from "@/lib/domain/types";
import type { EvidenceDoc, EvidenceMatch } from "@/lib/dispute/evidence";
import { matchEvidenceToItems } from "@/lib/dispute/evidence";

export type EvidenceKind =
  | "id"
  | "address_proof"
  | "statement"
  | "report_excerpt"
  | "response_letter"
  | "ftc_identity_report"
  | "medical_eob"
  | "au_agreement"
  | "other";

export type RequiredEvidence = {
  kind: EvidenceKind;
  label: string;
  required: boolean;
  why: string;
};

const GROUND_REQUIREMENTS: Record<GroundCode, RequiredEvidence[]> = {
  NOT_MINE: [
    {
      kind: "id",
      label: "Government-issued ID",
      required: true,
      why: "Prove identity for a not-mine / identity dispute.",
    },
    {
      kind: "address_proof",
      label: "Proof of address",
      required: true,
      why: "Match current address to the consumer file.",
    },
    {
      kind: "ftc_identity_report",
      label: "FTC Identity Theft Report (if applicable)",
      required: false,
      why: "Strengthens identity-theft claims.",
    },
    {
      kind: "report_excerpt",
      label: "Marked report excerpt",
      required: true,
      why: "Show the exact tradeline being disputed.",
    },
  ],
  MIXED_FILE: [
    {
      kind: "id",
      label: "Government-issued ID",
      required: true,
      why: "Separate your identity from mixed-file data.",
    },
    {
      kind: "address_proof",
      label: "Proof of address",
      required: true,
      why: "Show address mismatch / file contamination.",
    },
    {
      kind: "report_excerpt",
      label: "Marked report excerpt",
      required: true,
      why: "Highlight contaminated entries.",
    },
  ],
  INACCURATE_STATUS: [
    {
      kind: "statement",
      label: "Account / payment statement",
      required: true,
      why: "Prove the reported status or history is wrong.",
    },
    {
      kind: "report_excerpt",
      label: "Marked report excerpt",
      required: true,
      why: "Show the inaccurate fields as reported.",
    },
  ],
  INCOMPLETE: [
    {
      kind: "report_excerpt",
      label: "Cross-bureau report excerpt",
      required: true,
      why: "Show incomplete or inconsistent fields.",
    },
  ],
  OUTDATED: [
    {
      kind: "report_excerpt",
      label: "Marked report excerpt with dates",
      required: true,
      why: "Show DOFD / age of the negative item.",
    },
  ],
  DUPLICATE: [
    {
      kind: "report_excerpt",
      label: "Both duplicate tradelines marked",
      required: true,
      why: "Show the duplicate reporting clearly.",
    },
  ],
  UNVERIFIABLE: [
    {
      kind: "report_excerpt",
      label: "Marked report excerpt",
      required: true,
      why: "Identify what must be verified or deleted.",
    },
  ],
  MEDICAL_SPECIAL: [
    {
      kind: "medical_eob",
      label: "Itemized bill / insurance EOB",
      required: true,
      why: "Support medical collection challenges.",
    },
    {
      kind: "report_excerpt",
      label: "Marked report excerpt",
      required: true,
      why: "Show the medical collection as reported.",
    },
  ],
  AUTHORIZED_USER_ONLY: [
    {
      kind: "au_agreement",
      label: "Authorized-user / card agreement",
      required: true,
      why: "Prove AU status vs primary obligor reporting.",
    },
    {
      kind: "report_excerpt",
      label: "Marked report excerpt",
      required: true,
      why: "Show how the account is currently reported.",
    },
  ],
  UNAUTHORIZED_INQUIRY: [
    {
      kind: "report_excerpt",
      label: "Inquiry marked on report",
      required: true,
      why: "Identify the hard inquiry at issue.",
    },
  ],
};

export function requiredEvidenceForGround(ground: GroundCode): RequiredEvidence[] {
  return GROUND_REQUIREMENTS[ground] ?? [
    {
      kind: "report_excerpt",
      label: "Marked report excerpt",
      required: true,
      why: "Identify the disputed item.",
    },
  ];
}

export type EvidenceCoachItem = {
  itemId: string;
  creditor: string;
  groundCode: GroundCode;
  requirements: RequiredEvidence[];
  satisfied: { kind: EvidenceKind; evidenceId: string; label: string }[];
  missingRequired: RequiredEvidence[];
  readyToMail: boolean;
  coachMessage: string;
};

function kindsPresentForItem(
  item: ClassifiedDisputeItem,
  evidence: EvidenceDoc[],
  match: EvidenceMatch | undefined,
): Set<string> {
  const kinds = new Set<string>();
  const matchedIds = new Set(match?.evidenceIds ?? []);
  for (const doc of evidence) {
    if (matchedIds.has(doc.id) || doc.kind === "report_excerpt") {
      kinds.add(doc.kind);
    }
    // Identity docs apply case-wide for identity grounds
    if (
      (item.groundCode === "NOT_MINE" || item.groundCode === "MIXED_FILE") &&
      (doc.kind === "id" || doc.kind === "address_proof" || doc.kind === "ftc_identity_report")
    ) {
      kinds.add(doc.kind);
    }
  }
  return kinds;
}

export function buildEvidenceCoach(
  items: ClassifiedDisputeItem[],
  evidence: EvidenceDoc[],
): EvidenceCoachItem[] {
  const matches = matchEvidenceToItems(items, evidence);
  const byItem = new Map(matches.map((m) => [m.itemId, m]));

  return items.map((item) => {
    const requirements = requiredEvidenceForGround(item.groundCode);
    const kinds = kindsPresentForItem(item, evidence, byItem.get(item.id));
    const satisfied: EvidenceCoachItem["satisfied"] = [];
    const missingRequired: RequiredEvidence[] = [];

    for (const req of requirements) {
      if (kinds.has(req.kind)) {
        const doc = evidence.find((e) => e.kind === req.kind);
        satisfied.push({
          kind: req.kind,
          evidenceId: doc?.id ?? "case",
          label: doc?.label ?? req.label,
        });
      } else if (req.required) {
        missingRequired.push(req);
      }
    }

    const readyToMail = missingRequired.length === 0;
    const coachMessage = readyToMail
      ? "Required evidence is attached — ready for packet approval."
      : `Upload: ${missingRequired.map((m) => m.label).join(", ")}.`;

    return {
      itemId: item.id,
      creditor: item.creditor,
      groundCode: item.groundCode,
      requirements,
      satisfied,
      missingRequired,
      readyToMail,
      coachMessage,
    };
  });
}

export function mailBlockedByEvidence(coach: EvidenceCoachItem[]): {
  blocked: boolean;
  messages: string[];
} {
  const notReady = coach.filter((c) => !c.readyToMail);
  return {
    blocked: notReady.length > 0,
    messages: notReady.map((c) => `${c.creditor}: ${c.coachMessage}`),
  };
}
