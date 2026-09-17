import type { Bureau } from "./types";

/** Verify before each live send — prefer address printed on the consumer's report. */
export const CRA_ADDRESSES: Record<
  Bureau,
  { legalName: string; lines: string[] }
> = {
  Equifax: {
    legalName: "Equifax Information Services LLC",
    lines: ["P.O. Box 740256", "Atlanta, GA 30374"],
  },
  Experian: {
    legalName: "Experian",
    lines: ["P.O. Box 4500", "Allen, TX 75013"],
  },
  TransUnion: {
    legalName: "TransUnion LLC Consumer Dispute Center",
    lines: ["P.O. Box 2000", "Chester, PA 19016"],
  },
};

export const ALL_BUREAUS: Bureau[] = ["Equifax", "Experian", "TransUnion"];
