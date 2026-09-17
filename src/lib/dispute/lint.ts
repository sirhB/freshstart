import type {
  ClassifiedDisputeItem,
  ConsumerIdentity,
  GeneratedLetter,
  LintIssue,
} from "@/lib/domain/types";
import type { EvidenceCoachItem } from "@/lib/dispute/evidence-coach";
import { mailBlockedByEvidence } from "@/lib/dispute/evidence-coach";

const GUARANTEE_RE =
  /\b(guaranteed?\s+delet|we\s+will\s+remove\s+anything|100%\s+removal|guaranteed?\s+score)\b/i;

export function lintLetter(input: {
  consumer: ConsumerIdentity;
  items: ClassifiedDisputeItem[];
  body: string;
  enclosureList: string[];
  maxItems?: number;
  /** When provided, missing required evidence becomes a lint error (blocks mail). */
  evidenceCoach?: EvidenceCoachItem[];
}): LintIssue[] {
  const issues: LintIssue[] = [];
  const maxItems = input.maxItems ?? 5;

  if (!input.consumer.fullName.trim()) {
    issues.push({
      code: "missing_name",
      severity: "error",
      message: "Consumer full name is required.",
    });
  }
  if (!input.consumer.addressLine1.trim() || !input.consumer.cityStateZip.trim()) {
    issues.push({
      code: "missing_address",
      severity: "error",
      message: "Consumer mailing address is required.",
    });
  }

  if (input.items.length === 0) {
    issues.push({
      code: "no_items",
      severity: "error",
      message: "Letter must dispute at least one item.",
    });
  }

  if (input.items.length > maxItems) {
    issues.push({
      code: "too_many_items",
      severity: "error",
      message: `Packet exceeds max items per letter (${maxItems}). Split into another wave.`,
    });
  }

  for (const item of input.items) {
    if (!item.creditor.trim()) {
      issues.push({
        code: "missing_creditor",
        severity: "error",
        message: "Each item needs a creditor name.",
      });
    }
    if (!item.groundRationale || item.groundRationale.length < 40) {
      issues.push({
        code: "vague_rationale",
        severity: "error",
        message: `Item ${item.creditor} needs a specific field-level rationale.`,
      });
    }
    if (item.riskFlags.includes("accurate_looking")) {
      issues.push({
        code: "accurate_looking",
        severity: "error",
        message: `Item ${item.creditor} looks accurate-but-negative and must not be mailed without human override.`,
      });
    }
    if (
      item.riskFlags.includes("needs_payment_evidence") ||
      item.riskFlags.includes("needs_identity_evidence")
    ) {
      issues.push({
        code: "missing_evidence_flag",
        severity: "warning",
        message: `Item ${item.creditor} should include supporting evidence before mailing.`,
      });
    }
  }

  if (GUARANTEE_RE.test(input.body)) {
    issues.push({
      code: "guarantee_language",
      severity: "error",
      message: "Letter must not claim guaranteed deletion or score increases.",
    });
  }

  if (!/fair credit reporting act|15\s*u\.?\s*s\.?\s*c\.?\s*§?\s*1681/i.test(input.body)) {
    issues.push({
      code: "missing_fcra_cite",
      severity: "warning",
      message: "Letter should cite the Fair Credit Reporting Act / §1681.",
    });
  }

  if (input.enclosureList.length === 0) {
    issues.push({
      code: "no_enclosures",
      severity: "warning",
      message: "CFPB guidance recommends enclosing ID, address proof, and marked report pages.",
    });
  }

  if (input.evidenceCoach && input.evidenceCoach.length > 0) {
    const itemIds = new Set(input.items.map((i) => i.id));
    const relevant = input.evidenceCoach.filter((c) => itemIds.has(c.itemId));
    const gate = mailBlockedByEvidence(relevant);
    if (gate.blocked) {
      for (const message of gate.messages) {
        issues.push({
          code: "missing_required_evidence",
          severity: "error",
          message,
        });
      }
    }
  }

  return issues;
}

export function applyLintToLetter(letter: GeneratedLetter): GeneratedLetter {
  const lintPassed = letter.lintIssues.every((i) => i.severity !== "error");
  return { ...letter, lintPassed };
}
