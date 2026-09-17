import type { GroundCode } from "./types";

export const GROUND_CATALOG: Record<
  GroundCode,
  { label: string; description: string; defaultRemedy: "delete" | "correct" }
> = {
  NOT_MINE: {
    label: "Not mine",
    description:
      "Account or inquiry does not belong to the consumer (identity theft or mixed file).",
    defaultRemedy: "delete",
  },
  INACCURATE_STATUS: {
    label: "Inaccurate status or history",
    description:
      "Reported status, balance, dates, or payment history conflicts with records.",
    defaultRemedy: "correct",
  },
  INCOMPLETE: {
    label: "Incomplete reporting",
    description:
      "Required completeness is missing (e.g., inconsistent Metro 2 fields across bureaus).",
    defaultRemedy: "correct",
  },
  OUTDATED: {
    label: "Past reporting period",
    description:
      "Negative information appears outside the FCRA reporting window (generally 7 years; bankruptcy 10).",
    defaultRemedy: "delete",
  },
  DUPLICATE: {
    label: "Duplicate tradeline",
    description: "The same obligation is reported more than once in a misleading way.",
    defaultRemedy: "delete",
  },
  UNVERIFIABLE: {
    label: "Cannot be verified",
    description:
      "Consumer requests reasonable investigation; information should be deleted if unverifiable.",
    defaultRemedy: "delete",
  },
  MIXED_FILE: {
    label: "Mixed file",
    description: "File appears contaminated with another consumer's information.",
    defaultRemedy: "delete",
  },
  MEDICAL_SPECIAL: {
    label: "Medical collection issue",
    description:
      "Medical collection may be unverified, paid, insured, or otherwise improperly reported.",
    defaultRemedy: "delete",
  },
  AUTHORIZED_USER_ONLY: {
    label: "Authorized user misreported",
    description: "Consumer was an authorized user but is reported as a primary obligor.",
    defaultRemedy: "correct",
  },
  UNAUTHORIZED_INQUIRY: {
    label: "Unauthorized inquiry",
    description: "Hard inquiry without permissible purpose or consumer authorization.",
    defaultRemedy: "delete",
  },
};

/** Accurate-but-negative items must not be auto-disputed. */
export const NON_DISPUTE_FLAGS = ["accurate_looking", "no_actionable_inaccuracy"] as const;
