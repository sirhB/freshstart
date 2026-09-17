import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { aggregateOutcomeInsights } from "@/lib/dispute/insights";

export const dynamic = "force-dynamic";

export async function GET() {
  const events = await prisma.outcomeEvent.findMany({
    include: {
      item: {
        select: {
          groundCode: true,
          furnisherName: true,
          creditor: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 2000,
  });

  const insights = aggregateOutcomeInsights(events);
  return NextResponse.json({
    totalEvents: events.length,
    ...insights,
  });
}
