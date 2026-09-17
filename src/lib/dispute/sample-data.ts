import type { Bureau, ConsumerIdentity, TradelineInput } from "@/lib/domain/types";

export const SAMPLE_CONSUMER: ConsumerIdentity = {
  fullName: "Jordan Hale",
  addressLine1: "1842 Meridian Avenue",
  cityStateZip: "Austin, TX 78702",
  dateOfBirth: "04/12/1991",
  phone: "(512) 555-0148",
  reportFileNumber: "FS-2026-0912-JH",
  ssnLast4: "4281",
};

export const SAMPLE_TRADELINES: TradelineInput[] = [
  {
    id: "tl_01",
    creditor: "Capital One",
    accountNumber: "****8891",
    accountType: "Revolving credit card",
    status: "Charge-off · 120 days late",
    balance: "$2,841",
    dateOpened: "03/2019",
    furnisherName: "Capital One",
    furnisherAddress:
      "Capital One Bank (USA), N.A.\nP.O. Box 30285\nSalt Lake City, UT 84130",
    bureaus: ["Equifax", "Experian", "TransUnion"],
    signals: {
      missingMetro2Fields: true,
      hasSupportingEvidence: false,
    },
    rawNotes: "Bureau balance/status inconsistency across EQ/EX/TU",
  },
  {
    id: "tl_02",
    creditor: "Synchrony Bank / Midland Credit",
    accountNumber: "****4412",
    accountType: "Collection",
    status: "Open collection",
    balance: "$1,204",
    dateOpened: "11/2020",
    furnisherName: "Midland Credit Management",
    furnisherAddress:
      "Midland Credit Management, Inc.\nP.O. Box 603548\nSan Diego, CA 92160",
    bureaus: ["Experian", "TransUnion"],
    signals: {
      notMine: true,
      hasSupportingEvidence: true,
    },
  },
  {
    id: "tl_03",
    creditor: "OneMain Financial",
    accountNumber: "****2207",
    accountType: "Installment loan",
    status: "Late 30 / Late 60",
    balance: "$4,670",
    dateOpened: "07/2021",
    furnisherName: "OneMain Financial",
    furnisherAddress:
      "OneMain Financial\nP.O. Box 3251\nEvansville, IN 47731",
    bureaus: ["Equifax", "TransUnion"],
    signals: {
      paymentRecordsConflict: true,
      hasSupportingEvidence: true,
    },
  },
  {
    id: "tl_04",
    creditor: "Medical Collection — Ascension",
    accountNumber: "****9033",
    accountType: "Medical collection",
    status: "Open collection",
    balance: "$486",
    dateOpened: "02/2023",
    furnisherName: "Ascension / collection agent",
    bureaus: ["Equifax", "Experian"],
    signals: {
      medicalUnderThreshold: true,
      hasSupportingEvidence: false,
    },
  },
  {
    id: "tl_05",
    creditor: "Affirm",
    accountNumber: undefined,
    accountType: "Hard inquiry",
    status: "Hard pull",
    balance: "—",
    dateOpened: "08/2025",
    furnisherName: "Affirm Inc.",
    bureaus: ["Experian"],
    signals: {
      unauthorizedInquiry: true,
    },
  },
  {
    id: "tl_06",
    creditor: "Local Credit Union Auto",
    accountNumber: "****1102",
    accountType: "Installment loan",
    status: "Current · was 30 days late once",
    balance: "$9,120",
    dateOpened: "01/2024",
    furnisherName: "Local Credit Union",
    bureaus: ["Equifax", "Experian", "TransUnion"],
    // accurate-looking late — should NOT be recommended
    signals: {},
  },
];

export const SAMPLE_SCORES: { bureau: Bureau; score: number }[] = [
  { bureau: "Equifax", score: 612 },
  { bureau: "Experian", score: 598 },
  { bureau: "TransUnion", score: 605 },
];

export const SAMPLE_REPORT_DATE = "September 12, 2026";
