import { NextResponse } from "next/server";
import { getPacket } from "@/lib/cases";
import { packetToPdfInput, renderLetterPdf } from "@/lib/dispute/pdf";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ packetId: string }> },
) {
  const { packetId } = await context.params;
  const packet = await getPacket(packetId);
  if (!packet) {
    return NextResponse.json({ error: "Packet not found" }, { status: 404 });
  }

  const pdf = await renderLetterPdf(packetToPdfInput(packet));
  const filename = `fresh-start-${packet.recipientName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")}-dispute.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
