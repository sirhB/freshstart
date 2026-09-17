import type { Bureau } from "@/lib/domain/types";

/** Known furnisher dispute addresses — expand over time / operator edits. */
export const FURNISHER_DIRECTORY: {
  name: string;
  addressLines: string[];
  aliases?: string[];
}[] = [
  {
    name: "Capital One",
    aliases: ["capital one bank"],
    addressLines: [
      "Capital One Bank (USA), N.A.",
      "P.O. Box 30285",
      "Salt Lake City, UT 84130",
    ],
  },
  {
    name: "Midland Credit Management",
    aliases: ["midland", "mcm"],
    addressLines: [
      "Midland Credit Management, Inc.",
      "P.O. Box 603548",
      "San Diego, CA 92160",
    ],
  },
  {
    name: "OneMain Financial",
    aliases: ["onemain"],
    addressLines: ["OneMain Financial", "P.O. Box 3251", "Evansville, IN 47731"],
  },
  {
    name: "Synchrony Bank",
    aliases: ["synchrony"],
    addressLines: [
      "Synchrony Bank",
      "P.O. Box 965012",
      "Orlando, FL 32896",
    ],
  },
  {
    name: "Affirm Inc.",
    aliases: ["affirm"],
    addressLines: ["Affirm Inc.", "P.O. Box 420", "San Francisco, CA 94104"],
  },
];

export function resolveFurnisherAddress(
  name: string,
): { name: string; addressLines: string[] } | null {
  const key = name.toLowerCase();
  const hit = FURNISHER_DIRECTORY.find(
    (f) =>
      f.name.toLowerCase() === key ||
      f.aliases?.some((a) => key.includes(a) || a.includes(key)) ||
      key.includes(f.name.toLowerCase()),
  );
  return hit ? { name: hit.name, addressLines: hit.addressLines } : null;
}

export function normalizeCreditorKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(inc|llc|na|bank|financial|collection|credit)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 24);
}

export type CrossBureauConflict = {
  key: string;
  creditor: string;
  fields: { field: string; values: { bureau: Bureau; value: string }[] }[];
};

/** Detect status/balance/date conflicts for the same account across bureaus. */
export function findCrossBureauConflicts(
  rows: {
    creditor: string;
    accountNumber?: string;
    status: string;
    balance?: string;
    dateOpened?: string;
    bureau: Bureau;
  }[],
): CrossBureauConflict[] {
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const last4 = row.accountNumber?.replace(/\D/g, "").slice(-4) ?? "";
    const key = `${normalizeCreditorKey(row.creditor)}_${last4}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const conflicts: CrossBureauConflict[] = [];
  for (const [key, list] of groups) {
    if (list.length < 2) continue;
    const bureauSet = new Set(list.map((r) => r.bureau));
    // Same-bureau duplicates are not cross-bureau conflicts (often parse noise).
    if (bureauSet.size < 2) continue;
    const fields: CrossBureauConflict["fields"] = [];
    for (const field of ["status", "balance", "dateOpened"] as const) {
      const values = list
        .map((r) => ({ bureau: r.bureau, value: (r[field] ?? "").trim() }))
        .filter((v) => v.value);
      const uniq = new Set(values.map((v) => v.value.toLowerCase()));
      if (uniq.size > 1) {
        fields.push({ field, values });
      }
    }
    if (fields.length > 0) {
      conflicts.push({
        key,
        creditor: list[0].creditor,
        fields,
      });
    }
  }
  return conflicts;
}
