import { CRA_ADDRESSES } from "@/lib/domain/addresses";
import type {
  Bureau,
  ClassifiedDisputeItem,
  ConsumerIdentity,
  GeneratedLetter,
} from "@/lib/domain/types";
import { applyLintToLetter, lintLetter } from "@/lib/dispute/lint";

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function identityBlock(consumer: ConsumerIdentity): string {
  const lines = [
    consumer.fullName,
    consumer.addressLine1,
    consumer.cityStateZip,
  ];
  if (consumer.phone) lines.push(`Phone: ${consumer.phone}`);
  if (consumer.dateOfBirth) lines.push(`Date of birth: ${consumer.dateOfBirth}`);
  if (consumer.reportFileNumber) {
    lines.push(`Credit report / file number: ${consumer.reportFileNumber}`);
  }
  if (consumer.ssnLast4) lines.push(`SSN (last four): XXX-XX-${consumer.ssnLast4}`);
  return lines.join("\n");
}

function itemBlock(item: ClassifiedDisputeItem, index: number): string {
  const account = item.accountNumber
    ? `Account number (as shown): ${item.accountNumber}`
    : "Account number (as shown): [see enclosed report excerpt]";
  const dates = [
    item.dateOpened ? `Opened: ${item.dateOpened}` : null,
    `Status reported: ${item.statusReported}`,
    item.balance ? `Balance reported: ${item.balance}` : null,
  ]
    .filter(Boolean)
    .join("; ");

  const remedy =
    item.remedy === "correct"
      ? "I request that you correct this information to be accurate and complete, or delete it if it cannot be verified."
      : "I request that you delete this information if it cannot be verified as accurate, complete, and timely.";

  return [
    `${index + 1}. Creditor / furnisher: ${item.furnisherName ?? item.creditor}`,
    `   Type of information: ${item.accountType}`,
    `   ${account}`,
    `   Dates of disputed information: ${dates}`,
    `   Company that provided the disputed information: ${item.furnisherName ?? item.creditor}`,
    `   Explanation of inaccuracy: ${item.groundRationale}`,
    `   Requested action: ${remedy}`,
  ].join("\n");
}

function defaultEnclosures(consumer: ConsumerIdentity, items: ClassifiedDisputeItem[]): string[] {
  const list = [
    "Copy of government-issued identification",
    "Copy of proof of address (utility, bank, or insurance statement)",
    "Copy of the relevant credit report pages with disputed items marked",
  ];
  if (items.some((i) => i.groundCode === "NOT_MINE" || i.groundCode === "MIXED_FILE")) {
    list.push("Identity Theft Report / FTC affidavit (if applicable)");
  }
  if (items.some((i) => i.evidenceNotes?.toLowerCase().includes("payment"))) {
    list.push("Copies of payment records / account statements supporting the dispute");
  }
  if (consumer.reportFileNumber) {
    list.push(`Reference: report/file number ${consumer.reportFileNumber}`);
  }
  return list;
}

export function buildCraLetter(input: {
  consumer: ConsumerIdentity;
  bureau: Bureau;
  items: ClassifiedDisputeItem[];
  asOf?: Date;
  enclosureList?: string[];
}): GeneratedLetter {
  const asOf = input.asOf ?? new Date();
  const items = input.items.filter((i) => i.bureaus.includes(input.bureau));
  const addr = CRA_ADDRESSES[input.bureau];
  const enclosures = input.enclosureList ?? defaultEnclosures(input.consumer, items);

  const body = `${identityBlock(input.consumer)}

${formatDate(asOf)}

${addr.legalName}
${addr.lines.join("\n")}

Re: Credit report dispute under the Fair Credit Reporting Act (15 U.S.C. § 1681i)

To Whom It May Concern:

I am writing to dispute inaccurate and/or incomplete information in my credit file maintained by ${addr.legalName}. Please conduct a reasonable reinvestigation of each item below, forward all relevant information I have provided to the furnisher(s), and delete or correct any information that is inaccurate, incomplete, or that cannot be verified.

Disputed items:

${items.map((item, i) => itemBlock(item, i)).join("\n\n") || "(No selected items appear on this bureau.)"}

Please provide written results of your reinvestigation. If any information is deleted or corrected, please also send me an updated copy of my consumer report free of charge.

Enclosures:
${enclosures.map((e, i) => `${i + 1}. ${e}`).join("\n")}

Thank you for your prompt attention to this matter.

Sincerely,

${input.consumer.fullName}
`;

  const lintIssues = lintLetter({
    consumer: input.consumer,
    items,
    body,
    enclosureList: enclosures,
  });

  return applyLintToLetter({
    recipient: { type: "cra", bureau: input.bureau },
    subject: `Credit report dispute — ${input.consumer.fullName}`,
    body,
    enclosureList: enclosures,
    itemIds: items.map((i) => i.id),
    lintIssues,
    lintPassed: false,
  });
}

export function buildFurnisherLetter(input: {
  consumer: ConsumerIdentity;
  items: ClassifiedDisputeItem[];
  furnisherName: string;
  furnisherAddressLines: string[];
  reportName?: string;
  asOf?: Date;
  enclosureList?: string[];
}): GeneratedLetter {
  const asOf = input.asOf ?? new Date();
  const items = input.items;
  const enclosures = input.enclosureList ?? defaultEnclosures(input.consumer, items);
  const reportName = input.reportName ?? "my consumer credit report";

  const body = `${identityBlock(input.consumer)}

${formatDate(asOf)}

${input.furnisherName}
${input.furnisherAddressLines.join("\n")}

Re: Direct dispute of information furnished for ${reportName} (Fair Credit Reporting Act / Reg. V)

To Whom It May Concern:

I am writing to dispute information your company furnished to one or more consumer reporting agencies. Please conduct a reasonable investigation of each item below and correct or delete any information that is inaccurate, incomplete, or unverifiable. If you determine the information is inaccurate, please promptly notify each consumer reporting agency to which you furnished it and provide the correction needed to make the information accurate.

Disputed items:

${items.map((item, i) => itemBlock(item, i)).join("\n\n")}

Please report the results of your investigation to me in writing before the applicable FCRA deadline.

Enclosures:
${enclosures.map((e, i) => `${i + 1}. ${e}`).join("\n")}

Thank you for your prompt attention to this matter.

Sincerely,

${input.consumer.fullName}
`;

  const lintIssues = lintLetter({
    consumer: input.consumer,
    items,
    body,
    enclosureList: enclosures,
  });

  return applyLintToLetter({
    recipient: {
      type: "furnisher",
      name: input.furnisherName,
      addressLines: input.furnisherAddressLines,
    },
    subject: `Direct dispute — ${input.consumer.fullName} / ${input.furnisherName}`,
    body,
    enclosureList: enclosures,
    itemIds: items.map((i) => i.id),
    lintIssues,
    lintPassed: false,
  });
}

export function buildDisputePacket(input: {
  consumer: ConsumerIdentity;
  items: ClassifiedDisputeItem[];
  asOf?: Date;
  includeFurnisherLetters?: boolean;
}): GeneratedLetter[] {
  const letters: GeneratedLetter[] = [];
  const bureaus: Bureau[] = ["Equifax", "Experian", "TransUnion"];

  for (const bureau of bureaus) {
    const bureauItems = input.items.filter((i) => i.bureaus.includes(bureau));
    if (bureauItems.length === 0) continue;
    letters.push(
      buildCraLetter({
        consumer: input.consumer,
        bureau,
        items: bureauItems,
        asOf: input.asOf,
      }),
    );
  }

  if (input.includeFurnisherLetters !== false) {
    const byFurnisher = new Map<string, ClassifiedDisputeItem[]>();
    for (const item of input.items) {
      const key = (item.furnisherName ?? item.creditor).trim();
      const list = byFurnisher.get(key) ?? [];
      list.push(item);
      byFurnisher.set(key, list);
    }

    for (const [name, furnisherItems] of byFurnisher) {
      const address =
        furnisherItems.find((i) => i.furnisherAddress)?.furnisherAddress ??
        "Address for credit reporting disputes\n(as listed on my consumer report)";
      letters.push(
        buildFurnisherLetter({
          consumer: input.consumer,
          items: furnisherItems,
          furnisherName: name,
          furnisherAddressLines: address.split("\n"),
          asOf: input.asOf,
        }),
      );
    }
  }

  return letters;
}
