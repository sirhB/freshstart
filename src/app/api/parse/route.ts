import { NextResponse } from "next/server";
import {
  parseCreditReportPdf,
  parseCreditReportText,
} from "@/lib/dispute/parse-report";
import { createCaseFromTradelines } from "@/lib/workflow";
import type { ConsumerIdentity } from "@/lib/domain/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      const createCase = form.get("createCase") === "true";
      const consumerRaw = form.get("consumer");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "file required" }, { status: 400 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const parsed = await parseCreditReportPdf(buffer);

      if (createCase && consumerRaw && typeof consumerRaw === "string") {
        const consumer = JSON.parse(consumerRaw) as ConsumerIdentity;
        const disputeCase = await createCaseFromTradelines({
          consumer,
          tradelines: parsed.tradelines,
          reportDate: parsed.reportDate,
        });
        return NextResponse.json({ parsed, case: disputeCase });
      }
      return NextResponse.json({ parsed });
    }

    const body = (await request.json()) as {
      text?: string;
      createCase?: boolean;
      consumer?: ConsumerIdentity;
    };
    if (!body.text) {
      return NextResponse.json({ error: "text required" }, { status: 400 });
    }
    const parsed = parseCreditReportText(body.text);
    if (body.createCase && body.consumer) {
      const disputeCase = await createCaseFromTradelines({
        consumer: body.consumer,
        tradelines: parsed.tradelines,
        reportDate: parsed.reportDate,
      });
      return NextResponse.json({ parsed, case: disputeCase });
    }
    return NextResponse.json({ parsed });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Parse failed" },
      { status: 400 },
    );
  }
}
