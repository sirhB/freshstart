import { NextResponse } from "next/server";
import { listFurnishers, seedFurnisherDirectory } from "@/lib/workflow";

export const dynamic = "force-dynamic";

export async function GET() {
  let rows = await listFurnishers();
  if (rows.length === 0) {
    rows = await seedFurnisherDirectory();
  }
  return NextResponse.json({ furnishers: rows });
}

export async function POST() {
  const rows = await seedFurnisherDirectory();
  return NextResponse.json({ furnishers: rows });
}
