import type { ClassifiedDisputeItem } from "@/lib/domain/types";
import type { EvidenceCoachItem } from "@/lib/dispute/evidence-coach";

/** Rough relative score impact weights for prioritization (not a bureau model). */
const GROUND_IMPACT: Record<string, number> = {
  NOT_MINE: 0.95,
  MIXED_FILE: 0.95,
  INACCURATE_STATUS: 0.8,
  OUTDATED: 0.75,
  DUPLICATE: 0.7,
  UNAUTHORIZED_INQUIRY: 0.55,
  MEDICAL_SPECIAL: 0.6,
  INCOMPLETE: 0.5,
  AUTHORIZED_USER_ONLY: 0.65,
  UNVERIFIABLE: 0.45,
};

export type ImpactRankedItem = {
  item: ClassifiedDisputeItem;
  impact: number;
  winnability: number;
  evidenceStrength: number;
  score: number;
  rationale: string;
};

function parseBalance(balance?: string): number {
  if (!balance) return 0;
  const n = Number(balance.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function rankDisputeItems(
  items: ClassifiedDisputeItem[],
  coach?: EvidenceCoachItem[],
): ImpactRankedItem[] {
  const coachById = new Map((coach ?? []).map((c) => [c.itemId, c]));

  return items
    .map((item) => {
      const groundImpact = GROUND_IMPACT[item.groundCode] ?? 0.4;
      const balanceFactor = Math.min(1, parseBalance(item.balance) / 5000);
      const bureauFactor = Math.min(1, item.bureaus.length / 3);
      const impact = Math.min(1, groundImpact * 0.7 + balanceFactor * 0.2 + bureauFactor * 0.1);

      const c = coachById.get(item.id);
      const evidenceStrength = c
        ? c.readyToMail
          ? 1
          : Math.max(0.15, 1 - c.missingRequired.length * 0.25)
        : item.evidenceNotes
          ? 0.55
          : 0.25;

      const riskPenalty = item.riskFlags.includes("accurate_looking")
        ? 0.15
        : item.riskFlags.includes("requires_human_review")
          ? 0.55
          : 1;

      const winnability = Math.min(1, item.confidence * riskPenalty * (0.6 + evidenceStrength * 0.4));
      const score = impact * 0.45 + winnability * 0.4 + evidenceStrength * 0.15;

      const rationale = `${item.groundCode} · impact ${(impact * 100).toFixed(0)}% · win ${(winnability * 100).toFixed(0)}% · evidence ${(evidenceStrength * 100).toFixed(0)}%`;

      return { item, impact, winnability, evidenceStrength, score, rationale };
    })
    .sort((a, b) => b.score - a.score);
}

export function suggestWave(
  ranked: ImpactRankedItem[],
  maxItems = 5,
): ImpactRankedItem[] {
  return ranked
    .filter((r) => r.item.recommended || r.score >= 0.45)
    .filter((r) => !r.item.riskFlags.includes("accurate_looking"))
    .slice(0, maxItems);
}
