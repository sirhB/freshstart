import { NextResponse } from "next/server";
import { listCases } from "@/lib/cases";

export const dynamic = "force-dynamic";

export async function GET() {
  const cases = await listCases();
  return NextResponse.json({ cases });
}
