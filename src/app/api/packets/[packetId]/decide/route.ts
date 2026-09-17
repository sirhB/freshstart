import { NextResponse } from "next/server";
import { decidePacket } from "@/lib/cases";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ packetId: string }> },
) {
  const { packetId } = await context.params;
  const body = (await request.json()) as {
    actor?: string;
    decision?: "approved" | "denied";
    reason?: string;
  };

  if (body.decision !== "approved" && body.decision !== "denied") {
    return NextResponse.json({ error: "decision required" }, { status: 400 });
  }

  try {
    const disputeCase = await decidePacket({
      packetId,
      actor: body.actor ?? "operator",
      decision: body.decision,
      reason: body.reason,
    });
    return NextResponse.json({ case: disputeCase });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 400 },
    );
  }
}
