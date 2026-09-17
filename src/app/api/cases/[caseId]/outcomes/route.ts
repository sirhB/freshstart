import { NextResponse } from "next/server";
import {
  classifyAndRecordResponse,
  recordOutcomes,
  attachEvidence,
} from "@/lib/workflow";
import type { OutcomeCode } from "@/lib/dispute/outcomes";
import { prisma } from "@/lib/db";
import { classifyResponseText } from "@/lib/dispute/outcomes";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  const { caseId } = await context.params;
  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const itemId = String(form.get("itemId") ?? "");
      const actor = String(form.get("actor") ?? "consumer");
      const file = form.get("file");
      let responseText = String(form.get("responseText") ?? "");
      let attachedFile = false;

      if (!itemId) {
        return NextResponse.json({ error: "itemId required" }, { status: 400 });
      }

      if (file && typeof file !== "string" && "arrayBuffer" in file) {
        const buf = Buffer.from(await file.arrayBuffer());
        const name = "name" in file ? String(file.name) : "response.pdf";
        if (!responseText.trim()) {
          if (
            name.toLowerCase().endsWith(".pdf") ||
            buf.subarray(0, 4).toString() === "%PDF"
          ) {
            try {
              const { PDFParse } = await import("pdf-parse");
              const parser = new PDFParse({ data: buf });
              const result = await parser.getText();
              responseText = result.text ?? "";
              await parser.destroy?.();
            } catch {
              responseText = buf
                .toString("utf8")
                .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, " ");
            }
          } else {
            responseText = buf.toString("utf8");
          }
        }

        const disputeCase = await prisma.disputeCase.findUnique({
          where: { id: caseId },
        });
        if (!disputeCase) {
          return NextResponse.json({ error: "Case not found" }, { status: 404 });
        }

        await attachEvidence({
          consumerId: disputeCase.consumerId,
          caseId,
          itemId,
          label: name || "Uploaded response letter",
          kind: "response_letter",
          storageKey: `upload://response/${caseId}/${Date.now()}-${name}`,
        });
        attachedFile = true;
      }

      if (!responseText.trim()) {
        return NextResponse.json(
          { error: "Could not extract text from upload; paste response text" },
          { status: 400 },
        );
      }

      const preview = classifyResponseText(responseText);
      const disputeCase = await classifyAndRecordResponse({
        caseId,
        itemId,
        actor,
        responseText,
        attachResponseLetter: !attachedFile,
      });
      return NextResponse.json({ case: disputeCase, classification: preview });
    }

    const body = (await request.json()) as {
      actor?: string;
      itemId?: string;
      responseText?: string;
      results?: { itemId: string; outcome: OutcomeCode; notes?: string }[];
    };

    if (body.itemId && body.responseText) {
      const disputeCase = await classifyAndRecordResponse({
        caseId,
        itemId: body.itemId,
        actor: body.actor ?? "operator",
        responseText: body.responseText,
      });
      return NextResponse.json({ case: disputeCase });
    }
    if (!body.results?.length) {
      return NextResponse.json(
        { error: "results or itemId+responseText required" },
        { status: 400 },
      );
    }
    const disputeCase = await recordOutcomes({
      caseId,
      actor: body.actor ?? "operator",
      results: body.results,
      responseText: body.responseText,
    });
    return NextResponse.json({ case: disputeCase });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 400 },
    );
  }
}
