export type OutcomeInsightRow = {
  key: string;
  groundCode?: string;
  furnisher?: string;
  total: number;
  deleted: number;
  corrected: number;
  verified: number;
  frivolous: number;
  no_response: number;
  reinserted: number;
  winRate: number;
};

type OutcomeEventLike = {
  outcome: string;
  item?: {
    groundCode?: string | null;
    furnisherName?: string | null;
    creditor?: string | null;
  } | null;
};

function emptyCounts() {
  return {
    total: 0,
    deleted: 0,
    corrected: 0,
    verified: 0,
    frivolous: 0,
    no_response: 0,
    reinserted: 0,
  };
}

function bump(
  row: ReturnType<typeof emptyCounts>,
  outcome: string,
) {
  row.total += 1;
  if (outcome in row) {
    (row as Record<string, number>)[outcome] += 1;
  }
}

function winRate(row: ReturnType<typeof emptyCounts>): number {
  if (row.total === 0) return 0;
  return (row.deleted + row.corrected) / row.total;
}

/** Aggregate outcome rates by ground and by furnisher for the learning dashboard. */
export function aggregateOutcomeInsights(
  events: OutcomeEventLike[],
): { byGround: OutcomeInsightRow[]; byFurnisher: OutcomeInsightRow[] } {
  const byGroundMap = new Map<string, ReturnType<typeof emptyCounts>>();
  const byFurnisherMap = new Map<string, ReturnType<typeof emptyCounts>>();

  for (const e of events) {
    const ground = e.item?.groundCode ?? "UNKNOWN";
    const furnisher =
      e.item?.furnisherName?.trim() || e.item?.creditor?.trim() || "Unknown";

    const g = byGroundMap.get(ground) ?? emptyCounts();
    bump(g, e.outcome);
    byGroundMap.set(ground, g);

    const f = byFurnisherMap.get(furnisher) ?? emptyCounts();
    bump(f, e.outcome);
    byFurnisherMap.set(furnisher, f);
  }

  const byGround: OutcomeInsightRow[] = [...byGroundMap.entries()]
    .map(([groundCode, counts]) => ({
      key: groundCode,
      groundCode,
      ...counts,
      winRate: winRate(counts),
    }))
    .sort((a, b) => b.total - a.total);

  const byFurnisher: OutcomeInsightRow[] = [...byFurnisherMap.entries()]
    .map(([furnisher, counts]) => ({
      key: furnisher,
      furnisher,
      ...counts,
      winRate: winRate(counts),
    }))
    .sort((a, b) => b.total - a.total);

  return { byGround, byFurnisher };
}
