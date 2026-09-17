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
  { bureau: "TransUnion", patterns: [/\btrans ?union\b/i, /\bTU\b/] },
];

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
  const blockRe =
    /(?:^|\n)\s*(?:Account|Creditor|Tradeline)\s*[:#]?\s*(.+)\n([\s\S]*?)(?=(?:\n\s*(?:Account|Creditor|Tradeline)\s*[:#]?)|$)/gi;

  let match: RegExpExecArray | null;
  let idx = 0;
  while ((match = blockRe.exec(text)) !== null) {
    idx += 1;
    const creditor = match[1].trim().slice(0, 120);
    const body = match[2];
    const accountNumber =
      body.match(/account\s*(?:number|#|no\.?)\s*[:#]?\s*([*\dXx-]{4,})/i)?.[1] ??
      body.match(/\*{2,}\d{3,4}/)?.[0];
    const status =
      body.match(/status\s*[:#]?\s*(.+)/i)?.[1]?.trim().split("\n")[0] ??
      "Unknown";
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
      b.patterns.some((p) => p.test(body)),
    ).map((b) => b.bureau);
    const bureaus =
      bureausInBlock.length > 0
        ? bureausInBlock
        : bureausDetected.length > 0
          ? bureausDetected
          : (["Equifax", "Experian", "TransUnion"] as Bureau[]);

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
      idx += 1;
      tradelines.push({
        id: `parsed_row_${idx}`,
        creditor: row[1].trim(),
        accountType: /inquiry/i.test(row[2]) ? "Hard inquiry" : "Account",
        status: row[2].trim(),
        balance: row[3],
        bureaus:
          bureausDetected.length > 0
            ? bureausDetected
            : ["Equifax", "Experian", "TransUnion"],
        signals: {},
      });
    }
    if (tradelines.length === 0) {
      warnings.push(
        "No tradeline blocks detected. Use 'Account:' / 'Creditor:' headings or pipe-delimited rows.",
      );
    }
  }

  const confidence =
    tradelines.length === 0
      ? 0.2
      : Math.min(0.95, 0.45 + tradelines.length * 0.08 + (fileNumber ? 0.1 : 0));

  if (bureausDetected.length === 0) {
    warnings.push("No bureau names detected; defaulted tradelines to all three CRAs.");
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
