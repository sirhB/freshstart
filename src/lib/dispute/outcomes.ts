export type OutcomeCode =
  | "deleted"
  | "corrected"
  | "verified"
  | "frivolous"
  | "no_response"
  | "reinserted";

export type ClassifiedOutcome = {
  outcome: OutcomeCode;
  confidence: number;
  summary: string;
};

/**
 * Classify a bureau/furnisher response letter (text) into an outcome.
 */
export function classifyResponseText(text: string): ClassifiedOutcome {
  const t = text.toLowerCase();

  if (/reinsert|re-?reported|appeared\s+again|restored\s+to\s+your\s+file/.test(t)) {
    return {
      outcome: "reinserted",
      confidence: 0.9,
      summary: "Response indicates previously deleted information was reinserted.",
    };
  }
  if (/frivolous|irrelevant|insufficient\s+information/.test(t)) {
    return {
      outcome: "frivolous",
      confidence: 0.88,
      summary: "CRA/furnisher marked the dispute frivolous or irrelevant.",
    };
  }
  if (/deleted|removed\s+from\s+your\s+(credit\s+)?(file|report)|has\s+been\s+deleted/.test(t)) {
    return {
      outcome: "deleted",
      confidence: 0.9,
      summary: "Information was deleted from the consumer file.",
    };
  }
  if (/updated|corrected|modified|information\s+has\s+been\s+changed/.test(t)) {
    return {
      outcome: "corrected",
      confidence: 0.85,
      summary: "Information was corrected/updated after investigation.",
    };
  }
  if (/verified|remains|accurate\s+as\s+reported|did\s+not\s+change|no\s+change/.test(t)) {
    return {
      outcome: "verified",
      confidence: 0.84,
      summary: "Information was verified and remains as reported.",
    };
  }
  if (/no\s+response|did\s+not\s+respond|failed\s+to\s+respond/.test(t)) {
    return {
      outcome: "no_response",
      confidence: 0.7,
      summary: "No timely response indicated.",
    };
  }

  return {
    outcome: "verified",
    confidence: 0.4,
    summary: "Could not confidently classify; defaulted to verified — human review recommended.",
  };
}

export function itemStatusForOutcome(outcome: OutcomeCode): string {
  switch (outcome) {
    case "deleted":
      return "resolved_deleted";
    case "corrected":
      return "resolved_corrected";
    case "reinserted":
      return "proposed";
    case "frivolous":
    case "verified":
    case "no_response":
    default:
      return "resolved_verified";
  }
}
