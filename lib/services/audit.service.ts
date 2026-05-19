import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";

export async function writeAuditLog(params: {
  userId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}) {
  return prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      targetType: params.targetType ?? null,
      targetId: params.targetId ?? null,
      metadata: (params.metadata as Prisma.InputJsonValue) ?? null,
      ip: params.ip ?? null,
    },
  });
}
