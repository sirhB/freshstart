import { NextResponse } from "next/server";
import { listNotifications, markNotificationRead } from "@/lib/workflow";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ consumerId: string }> },
) {
  const { consumerId } = await context.params;
  const notifications = await listNotifications(consumerId);
  return NextResponse.json({ notifications });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as { id?: string };
  if (!body.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const notification = await markNotificationRead(body.id);
  return NextResponse.json({ notification });
}
