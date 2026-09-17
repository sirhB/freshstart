import { NextResponse } from "next/server";
import { applyAutoApprovePlan } from "@/lib/cases";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  const { caseId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    actor?: string;
    overrideFirstWave?: boolean;
  };
  try {
    const disputeCase = await applyAutoApprovePlan({
      caseId,
      actor: body.actor ?? "operator",
      overrideFirstWave: body.overrideFirstWave ?? true,
    });
    return NextResponse.json({ case: disputeCase });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 400 },
    );
  }
}
