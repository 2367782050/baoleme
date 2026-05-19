import { prisma } from "@/lib/db";
import { findActiveMembership, getPlanCapabilities } from "./membership.service";

export type CapabilityKey =
  | "prompt_generate"
  | "article_generate"
  | "material_export"
  | "image_upload"
  | "draft_push"
  | "official_account_bind";

type PeriodType = "daily" | "monthly" | "lifetime";

function getPeriodInfo(capability: CapabilityKey): {
  periodType: PeriodType;
  quotaKey: string;
} {
  const mapping: Record<CapabilityKey, { periodType: PeriodType; quotaKey: string }> = {
    prompt_generate: { periodType: "monthly", quotaKey: "prompt_generate_monthly" },
    article_generate: { periodType: "daily", quotaKey: "article_generate_daily" },
    material_export: { periodType: "daily", quotaKey: "material_export_daily" },
    image_upload: { periodType: "daily", quotaKey: "image_upload_daily" },
    draft_push: { periodType: "daily", quotaKey: "draft_push_daily" },
    official_account_bind: { periodType: "lifetime", quotaKey: "official_account_limit" },
  };
  return mapping[capability];
}

function getPeriodKey(periodType: PeriodType): string {
  const now = new Date();
  if (periodType === "daily") {
    return now.toISOString().substring(0, 10); // 2026-05-18
  }
  if (periodType === "monthly") {
    return now.toISOString().substring(0, 7); // 2026-05
  }
  return "lifetime";
}

export async function getQuotaUsage(
  userId: string,
  capability: CapabilityKey,
): Promise<{ used: number; limit: number }> {
  const membership = await findActiveMembership(userId);
  if (!membership) {
    return { used: 0, limit: 0 };
  }

  const capabilities = getPlanCapabilities(membership.plan);
  const { periodType, quotaKey } = getPeriodInfo(capability);
  const limit = (capabilities as Record<string, number>)[quotaKey] ?? 0;
  const periodKey = getPeriodKey(periodType);

  const record = await prisma.quotaUsage.findUnique({
    where: {
      userId_capability_periodType_periodKey: {
        userId,
        capability,
        periodType,
        periodKey,
      },
    },
  });

  return { used: record?.used ?? 0, limit };
}

export async function assertCanUse(userId: string, capability: CapabilityKey): Promise<void> {
  const { used, limit } = await getQuotaUsage(userId, capability);
  if (limit === 0) {
    throw new QuotaExceededError(capability, "当前会员套餐无权使用此功能");
  }
  if (used >= limit) {
    throw new QuotaExceededError(capability, `${capability} 配额已用完`);
  }
}

export async function consume(
  userId: string,
  capability: CapabilityKey,
  amount: number = 1,
): Promise<void> {
  const { periodType } = getPeriodInfo(capability);
  const periodKey = getPeriodKey(periodType);

  await prisma.quotaUsage.upsert({
    where: {
      userId_capability_periodType_periodKey: {
        userId,
        capability,
        periodType,
        periodKey,
      },
    },
    create: {
      userId,
      capability,
      periodType,
      periodKey,
      used: amount,
    },
    update: {
      used: { increment: amount },
    },
  });
}

export class QuotaExceededError extends Error {
  code = "QUOTA_EXCEEDED";
  capability: CapabilityKey;

  constructor(capability: CapabilityKey, message: string) {
    super(message);
    this.name = "QuotaExceededError";
    this.capability = capability;
  }
}
