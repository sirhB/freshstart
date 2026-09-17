import { NextResponse } from "next/server";
import { openNextWave } from "@/lib/workflow";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  const { caseId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { actor?: string };
  try {
    const disputeCase = await openNextWave({
      caseId,
      actor: body.actor ?? "operator",
    });
    return NextResponse.json({ case: disputeCase });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 400 },
    );
  }
}
