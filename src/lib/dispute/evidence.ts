import type { ClassifiedDisputeItem } from "@/lib/domain/types";

export type EvidenceDoc = {
  id: string;
  label: string;
  kind: string;
  matchedAccountHint?: string | null;
};

export type EvidenceMatch = {
  itemId: string;
  evidenceIds: string[];
  score: number;
  notes: string[];
};

/**
 * Match uploaded evidence docs to dispute items by account last-4, creditor name, and kind.
 */
export function matchEvidenceToItems(
  items: ClassifiedDisputeItem[],
  evidence: EvidenceDoc[],
): EvidenceMatch[] {
  return items.map((item) => {
    const notes: string[] = [];
    const matched: string[] = [];
    let score = 0;

    const last4 = item.accountNumber?.replace(/\D/g, "").slice(-4);
    const creditorKey = item.creditor.toLowerCase();

    for (const doc of evidence) {
      let local = 0;
      const hint = (doc.matchedAccountHint ?? "").toLowerCase();
      const label = doc.label.toLowerCase();

      if (last4 && (hint.includes(last4) || label.includes(last4))) {
        local += 0.5;
        notes.push(`${doc.label}: account last-4 match`);
      }
      if (
        hint.includes(creditorKey.slice(0, 8)) ||
        label.includes(creditorKey.slice(0, 8))
      ) {
        local += 0.35;
        notes.push(`${doc.label}: creditor name match`);
      }

      if (
        (item.groundCode === "NOT_MINE" || item.groundCode === "MIXED_FILE") &&
        (doc.kind === "id" || doc.kind === "address_proof")
      ) {
        local += 0.25;
        notes.push(`${doc.label}: identity packet for ${item.groundCode}`);
      }
      if (
        item.groundCode === "INACCURATE_STATUS" &&
        doc.kind === "statement"
      ) {
        local += 0.3;
        notes.push(`${doc.label}: payment statement for status dispute`);
      }
      if (doc.kind === "report_excerpt") {
        local += 0.15;
        notes.push(`${doc.label}: report excerpt`);
      }

      if (local >= 0.25) {
        matched.push(doc.id);
        score += local;
      }
    }

    return {
      itemId: item.id,
      evidenceIds: matched,
      score: Math.min(1, score),
      notes,
    };
  });
}

export function evidenceStrengthBoost(match: EvidenceMatch): number {
  if (match.score >= 0.75) return 0.08;
  if (match.score >= 0.4) return 0.04;
  return 0;
}
