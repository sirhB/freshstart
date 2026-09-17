import { NextResponse } from "next/server";
import { listAllNotifications, markNotificationRead } from "@/lib/notifications";

export const dynamic = "force-dynamic";

/** Operator-wide notification feed (in-app). */
export async function GET() {
  const notifications = await listAllNotifications(50);
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
