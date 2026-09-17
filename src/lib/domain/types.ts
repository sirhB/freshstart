export type Bureau = "Equifax" | "Experian" | "TransUnion";

export type GroundCode =
  | "NOT_MINE"
  | "INACCURATE_STATUS"
  | "INCOMPLETE"
  | "OUTDATED"
  | "DUPLICATE"
  | "UNVERIFIABLE"
  | "MIXED_FILE"
  | "MEDICAL_SPECIAL"
  | "AUTHORIZED_USER_ONLY"
  | "UNAUTHORIZED_INQUIRY";

export type Remedy = "delete" | "correct";

export type DisputeItemStatus =
  | "proposed"
  | "approved"
  | "denied"
  | "queued"
  | "mailed"
  | "investigating"
  | "resolved_deleted"
  | "resolved_corrected"
  | "resolved_verified";

export type CaseStatus =
  | "draft"
  | "pending_plan_approval"
  | "pending_packet_approval"
  | "mailing"
  | "investigating"
  | "closed";

export type GateType =
  | "parse_review"
  | "dispute_plan"
  | "packet_signoff"
  | "mail_exception"
  | "outcome_exception"
  | "compliance_hold";

export type ConsumerIdentity = {
  fullName: string;
  addressLine1: string;
  cityStateZip: string;
  dateOfBirth?: string;
  phone?: string;
  email?: string;
  ssnLast4?: string;
  reportFileNumber?: string;
};

export type TradelineInput = {
  id: string;
  creditor: string;
  accountNumber?: string;
  accountType: string;
  status: string;
  balance?: string;
  dateOpened?: string;
  dateOfFirstDelinquency?: string;
  furnisherName?: string;
  furnisherAddress?: string;
  bureaus: Bureau[];
  rawNotes?: string;
  /** Optional signals for the classifier */
  signals?: {
    notMine?: boolean;
    paymentRecordsConflict?: boolean;
    missingMetro2Fields?: boolean;
    duplicateOfId?: string;
    identityMismatch?: boolean;
    unauthorizedInquiry?: boolean;
    medicalUnderThreshold?: boolean;
    authorizedUserOnly?: boolean;
    hasSupportingEvidence?: boolean;
  };
};

export type ClassifiedDisputeItem = {
  id: string;
  tradelineId: string;
  creditor: string;
  accountNumber?: string;
  accountType: string;
  statusReported: string;
  balance?: string;
  dateOpened?: string;
  furnisherName?: string;
  furnisherAddress?: string;
  bureaus: Bureau[];
  groundCode: GroundCode;
  groundRationale: string;
  remedy: Remedy;
  correctedValues?: Record<string, string>;
  confidence: number;
  recommended: boolean;
  evidenceNotes?: string;
  riskFlags: string[];
};

export type LintIssue = {
  code: string;
  severity: "error" | "warning";
  message: string;
};

export type LetterRecipient =
  | { type: "cra"; bureau: Bureau }
  | { type: "furnisher"; name: string; addressLines: string[] };

export type GeneratedLetter = {
  recipient: LetterRecipient;
  subject: string;
  body: string;
  enclosureList: string[];
  itemIds: string[];
  lintIssues: LintIssue[];
  lintPassed: boolean;
};
