import type { ClassifiedDisputeItem } from "@/lib/domain/types";

export type AutoApprovePolicy = {
  /** Minimum confidence to auto-approve a dispute item */
  minConfidence: number;
  /** Grounds safe for hands-free approval when confidence clears the bar */
  allowedGrounds: ClassifiedDisputeItem["groundCode"][];
  /** Risk flags that always force human review */
  blockingRiskFlags: string[];
  /** Require human review on the consumer's first wave */
  requireHumanOnFirstWave: boolean;
};

export const DEFAULT_AUTO_APPROVE_POLICY: AutoApprovePolicy = {
  minConfidence: 0.85,
  allowedGrounds: [
    "OUTDATED",
    "DUPLICATE",
    "INACCURATE_STATUS",
    "NOT_MINE",
    "UNAUTHORIZED_INQUIRY",
  ],
  blockingRiskFlags: [
    "accurate_looking",
    "no_actionable_inaccuracy",
    "requires_human_review",
    "medical_edge_case",
    "needs_identity_evidence",
    "needs_payment_evidence",
  ],
  requireHumanOnFirstWave: true,
};

export type AutoApproveDecision = {
  itemId: string;
  autoApprove: boolean;
  reason: string;
};

export function evaluateAutoApprove(
  items: ClassifiedDisputeItem[],
  options?: {
    policy?: AutoApprovePolicy;
    waveNumber?: number;
  },
): AutoApproveDecision[] {
  const policy = options?.policy ?? DEFAULT_AUTO_APPROVE_POLICY;
  const waveNumber = options?.waveNumber ?? 1;

  if (policy.requireHumanOnFirstWave && waveNumber <= 1) {
    return items.map((item) => ({
      itemId: item.id,
      autoApprove: false,
      reason: "First wave requires human plan approval",
    }));
  }

  return items.map((item) => {
    if (!item.recommended) {
      return {
        itemId: item.id,
        autoApprove: false,
        reason: "Not recommended by classifier",
      };
    }

    const blocking = item.riskFlags.filter((f) =>
      policy.blockingRiskFlags.includes(f),
    );
    if (blocking.length > 0) {
      return {
        itemId: item.id,
        autoApprove: false,
        reason: `Blocked by risk flags: ${blocking.join(", ")}`,
      };
    }

    if (item.confidence < policy.minConfidence) {
      return {
        itemId: item.id,
        autoApprove: false,
        reason: `Confidence ${item.confidence.toFixed(2)} below ${policy.minConfidence}`,
      };
    }

    if (!policy.allowedGrounds.includes(item.groundCode)) {
      return {
        itemId: item.id,
        autoApprove: false,
        reason: `Ground ${item.groundCode} requires human review`,
      };
    }

    return {
      itemId: item.id,
      autoApprove: true,
      reason: `Auto-approve: ${item.groundCode} @ ${(item.confidence * 100).toFixed(0)}%`,
    };
  });
}

/** Packet auto-approve: lint must pass and no blocking item risk on included items. */
export function canAutoApprovePacket(input: {
  lintPassed: boolean;
  items: ClassifiedDisputeItem[];
  policy?: AutoApprovePolicy;
  waveNumber?: number;
}): { ok: boolean; reason: string } {
  if (!input.lintPassed) {
    return { ok: false, reason: "Compliance lint failed" };
  }
  const decisions = evaluateAutoApprove(input.items, {
    policy: input.policy,
    waveNumber: input.waveNumber,
  });
  const blocked = decisions.filter((d) => !d.autoApprove);
  if (blocked.length > 0) {
    return {
      ok: false,
      reason: `Items need human review (${blocked.length})`,
    };
  }
  return { ok: true, reason: "All included items clear auto-approve policy" };
}
