import { prisma } from "@/lib/db";

export async function createNotification(input: {
  consumerId: string;
  caseId: string;
  title: string;
  body: string;
  channel?: "in_app" | "email_stub";
}) {
  await prisma.notification.create({
    data: {
      consumerId: input.consumerId,
      caseId: input.caseId,
      title: input.title,
      body: input.body,
      channel: input.channel ?? "in_app",
    },
  });
  if (input.channel === "email_stub" || !input.channel) {
    await prisma.auditLog.create({
      data: {
        caseId: input.caseId,
        action: "notification_email_stub",
        actor: "system",
        detailJson: JSON.stringify({ title: input.title, body: input.body }),
      },
    });
  }
}

export async function listNotifications(consumerId: string) {
  return prisma.notification.findMany({
    where: { consumerId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function listAllNotifications(take = 40) {
  return prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: {
      case: { select: { id: true, title: true } },
      consumer: { select: { id: true, fullName: true } },
    },
  });
}

export async function markNotificationRead(id: string) {
  return prisma.notification.update({
    where: { id },
    data: { read: true },
  });
}
