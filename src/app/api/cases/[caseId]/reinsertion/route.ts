import { NextResponse } from "next/server";
import {
  listReinsertionChecks,
  markReinsertionHit,
  runDueReinsertionChecks,
  scheduleReinsertionChecks,
} from "@/lib/workflow";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  const { caseId } = await context.params;
  const checks = await listReinsertionChecks(caseId);
  return NextResponse.json({ checks });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  const { caseId } = await context.params;
  const body = (await request.json()) as {
    action?: "schedule" | "run_due" | "mark_hit";
    itemId?: string;
    itemIds?: string[];
    checkId?: string;
    notes?: string;
    actor?: string;
  };

  try {
    if (body.action === "run_due") {
      const due = await runDueReinsertionChecks();
      const forCase = due.filter((d) => d.caseId === caseId);
      return NextResponse.json({ due: forCase });
    }
    if (body.action === "mark_hit") {
      if (!body.checkId) {
        return NextResponse.json({ error: "checkId required" }, { status: 400 });
      }
      const check = await markReinsertionHit({
        checkId: body.checkId,
        actor: body.actor ?? "operator",
        notes: body.notes,
      });
      return NextResponse.json({ check });
    }
    const itemIds =
      body.itemIds ?? (body.itemId ? [body.itemId] : []);
    if (itemIds.length === 0) {
      return NextResponse.json(
        { error: "itemId or itemIds required to schedule" },
        { status: 400 },
      );
    }
    const checks = await scheduleReinsertionChecks({
      caseId,
      itemIds,
    });
    return NextResponse.json({ checks });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 400 },
    );
  }
}
