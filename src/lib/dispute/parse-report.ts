import type { Bureau, TradelineInput } from "@/lib/domain/types";

export type ParsedReport = {
  bureausDetected: Bureau[];
  reportDate?: string;
  fileNumber?: string;
  tradelines: TradelineInput[];
  warnings: string[];
  confidence: number;
};

const BUREAU_ALIASES: { bureau: Bureau; patterns: RegExp[] }[] = [
  { bureau: "Equifax", patterns: [/\bequifax\b/i] },
  { bureau: "Experian", patterns: [/\bexperian\b/i] },
  { bureau: "TransUnion", patterns: [/\btrans\s*-?\s*union\b/i, /\bTU\b/] },
];

/** Labels that follow "Account …" in bureau PDF boilerplate — not creditor names. */
const NOISE_CREDITORS = new Set(
  [
    "details",
    "detail",
    "information",
    "info",
    "status",
    "type",
    "number",
    "history",
    "summary",
    "overview",
    "name",
    "s",
    "rating",
    "remarks",
    "comment",
    "comments",
    "balance",
    "payment",
    "payments",
    "opened",
    "closed",
    "responsibility",
    "terms",
    "high credit",
    "credit limit",
    "past due",
    "date opened",
    "date closed",
    "account type",
    "account number",
    "account status",
    "account details",
    "account information",
    "closed by credit grantor",
    "information disputed by consumer",
    "of an ongoing dispute with transunion",
    "of an ongoing dispute with experian",
    "of an ongoing dispute with equifax",
    "in dispute",
    "disputed",
    "unknown",
    "n/a",
    "none",
    "see below",
  ].map((s) => s.toLowerCase()),
);

const KNOWN_STATUS =
  /\b(paid|open|closed|current|collection|charge[- ]?off|late|derogatory|in\s+dispute|settled|repossession|foreclosure|included\s+in\s+bankruptcy|hard\s+pull|inquiry)\b/i;

function normalizeCreditorKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isNoiseCreditor(name: string): boolean {
  const key = normalizeCreditorKey(name);
  if (!key || key.length < 2) return true;
  if (NOISE_CREDITORS.has(key)) return true;
  if (/^(account|creditor|tradeline)\b/i.test(key)) return true;
  if (/disputed by consumer|closed by credit grantor|ongoing dispute/i.test(key)) {
    return true;
  }
  // Single generic words / field labels
  if (/^(details?|information|status|type|balance|remarks?)$/i.test(key)) return true;
  return false;
}

function looksLikeRealTradeline(t: {
  creditor: string;
  accountNumber?: string;
  status: string;
  balance?: string;
  accountType: string;
}): boolean {
  if (isNoiseCreditor(t.creditor)) return false;
  // Creditor should look like an org/person name, not a sentence fragment
  if (t.creditor.split(/\s+/).length > 8) return false;
  if (/^[a-z]/.test(t.creditor) && t.creditor.length < 4) return false;

  const hasAccount = Boolean(t.accountNumber && /[\d*]{3,}/.test(t.accountNumber));
  const hasBalance = Boolean(t.balance && /[\d]/.test(t.balance));
  const hasStatus = KNOWN_STATUS.test(t.status) && t.status.length < 80;
  const hasType =
    /collection|installment|revolving|mortgage|inquiry|credit\s*card|auto|student|charge/i.test(
      t.accountType,
    );

  // Need at least one account-like signal beyond a bare label
  return hasAccount || hasBalance || (hasStatus && hasType) || (hasStatus && hasAccount);
}

/**
 * Phase 3 spike: parse plain-text credit report extracts into tradelines.
 * Works on pasted OCR/text dumps; PDF binary parsing feeds text into this.
 */
export function parseCreditReportText(text: string): ParsedReport {
  const warnings: string[] = [];
  const bureausDetected = BUREAU_ALIASES.filter((b) =>
    b.patterns.some((p) => p.test(text)),
  ).map((b) => b.bureau);

  const fileNumber =
    text.match(/file\s*(?:number|#)\s*[:#]?\s*([A-Z0-9-]+)/i)?.[1] ??
    text.match(/confirmation\s*(?:number|#)\s*[:#]?\s*([A-Z0-9-]+)/i)?.[1];

  const reportDate =
    text.match(/report\s*date\s*[:#]?\s*([A-Za-z]+ \d{1,2},?\s*\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i)?.[1];

  const tradelines: TradelineInput[] = [];
  // Require a delimiter (colon) or "Account name" so "Account Details" is not a creditor.
  const blockRe =
    /(?:^|\n)\s*(?:Account\s*name|Creditor\s*name|Tradeline\s*name|Account|Creditor|Tradeline)\s*[:\-–]\s*(.+)\n([\s\S]*?)(?=(?:\n\s*(?:Account\s*name|Creditor\s*name|Tradeline\s*name|Account|Creditor|Tradeline)\s*[:\-–])|$)/gi;

  let match: RegExpExecArray | null;
  let idx = 0;
  let rejectedNoise = 0;
  while ((match = blockRe.exec(text)) !== null) {
    idx += 1;
    const creditor = match[1].trim().replace(/\s+/g, " ").slice(0, 120);
    const body = match[2];
    if (isNoiseCreditor(creditor)) {
      rejectedNoise += 1;
      continue;
    }

    const accountNumber =
      body.match(/account\s*(?:number|#|no\.?)\s*[:#]?\s*([*\dXx-]{4,})/i)?.[1] ??
      body.match(/\*{2,}\d{3,4}/)?.[0];
    const statusRaw =
      body.match(/status\s*[:#]?\s*(.+)/i)?.[1]?.trim().split("\n")[0] ?? "Unknown";
    const status = statusRaw.slice(0, 80);
    const balance = body.match(/balance\s*[:#]?\s*(\$?[\d,]+)/i)?.[1];
    const dateOpened =
      body.match(/(?:date\s*opened|opened)\s*[:#]?\s*([\d/]{4,10}|[A-Za-z]+ \d{4})/i)?.[1];
    const accountType =
      body.match(/(?:account\s*type|type)\s*[:#]?\s*(.+)/i)?.[1]?.trim().split("\n")[0] ??
      (/collection/i.test(body + creditor)
        ? "Collection"
        : /inquiry|hard\s*pull/i.test(body + creditor)
          ? "Hard inquiry"
          : "Account");

    const bureausInBlock = BUREAU_ALIASES.filter((b) =>
      b.patterns.some((p) => p.test(body) || p.test(creditor)),
    ).map((b) => b.bureau);
    const bureaus: Bureau[] =
      bureausInBlock.length > 0
        ? bureausInBlock
        : bureausDetected.length === 1
          ? bureausDetected
          : bureausDetected.length > 0
            ? bureausDetected
            : (["Equifax"] as Bureau[]);

    if (
      !looksLikeRealTradeline({
        creditor,
        accountNumber,
        status,
        balance,
        accountType,
      })
    ) {
      rejectedNoise += 1;
      continue;
    }

    const signals: TradelineInput["signals"] = {};
    if (/not\s+mine|identity\s+theft|fraud/i.test(body)) signals.notMine = true;
    if (/late|payment\s+history|inaccurate/i.test(body) && /statement|paid/i.test(body)) {
      signals.paymentRecordsConflict = true;
    }
    if (/incomplet|inconsist|metro\s*2/i.test(body)) signals.missingMetro2Fields = true;
    if (/unauthorized|no\s+permissible/i.test(body) || /inquiry/i.test(accountType)) {
      if (/unauthorized|no\s+permissible/i.test(body)) signals.unauthorizedInquiry = true;
    }
    if (/medical/i.test(creditor + accountType)) signals.medicalUnderThreshold = true;

    tradelines.push({
      id: `parsed_${idx}_${creditor.slice(0, 12).replace(/\W+/g, "_").toLowerCase()}`,
      creditor,
      accountNumber,
      accountType,
      status,
      balance,
      dateOpened,
      furnisherName: creditor,
      bureaus,
      signals,
      rawNotes: body.slice(0, 400),
    });
  }

  // Fallback: line-oriented "CREDITOR | status | balance" rows
  if (tradelines.length === 0) {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const row = line.match(
        /^([A-Za-z0-9 &.'/-]{3,40})\s+[|·-]\s+(.+?)\s+[|·-]\s+(\$?[\d,]+|—|-)$/,
      );
      if (!row) continue;
      const creditor = row[1].trim();
      if (isNoiseCreditor(creditor)) continue;
      idx += 1;
      tradelines.push({
        id: `parsed_row_${idx}`,
        creditor,
        accountType: /inquiry/i.test(row[2]) ? "Hard inquiry" : "Account",
        status: row[2].trim(),
        balance: row[3],
        bureaus:
          bureausDetected.length > 0
            ? bureausDetected
            : (["Equifax"] as Bureau[]),
        signals: {},
      });
    }
    if (tradelines.length === 0) {
      warnings.push(
        "No tradeline blocks detected. Use lines like 'Account: Midland Credit' (with a colon) plus Status/Balance.",
      );
    }
  }

  if (rejectedNoise > 0) {
    warnings.push(
      `Ignored ${rejectedNoise} boilerplate “Account …” section(s) that were not real creditors.`,
    );
  }

  const confidence =
    tradelines.length === 0
      ? 0.2
      : Math.min(0.95, 0.45 + tradelines.length * 0.08 + (fileNumber ? 0.1 : 0));

  if (bureausDetected.length === 0) {
    warnings.push("No bureau names detected; defaulted tradelines to Equifax.");
  }

  return {
    bureausDetected,
    reportDate,
    fileNumber,
    tradelines,
    warnings,
    confidence,
  };
}

/** Lightweight PDF text extraction wrapper — binary PDF → text → parseCreditReportText. */
export async function parseCreditReportPdf(
  buffer: Buffer,
): Promise<ParsedReport & { extractedTextPreview: string }> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const text = result.text || "";
    const parsed = parseCreditReportText(text);
    return {
      ...parsed,
      extractedTextPreview: text.slice(0, 2000),
    };
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}
