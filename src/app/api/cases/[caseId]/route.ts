import { NextResponse } from "next/server";
import { getCaseBundle } from "@/lib/cases";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  const { caseId } = await context.params;
  const bundle = await getCaseBundle(caseId);
  if (!bundle) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }
  return NextResponse.json({ case: bundle });
}
