import { prisma } from "@/lib/db";
import type { MembershipPlan, UserMembership } from "@/lib/generated/prisma/client";

export type PlanCapabilities = {
  prompt_generate_monthly?: number;
  article_generate_daily?: number;
  material_export_daily?: number;
  image_upload_daily?: number;
  draft_push_daily?: number;
  official_account_limit?: number;
};

export async function listActivePlans(): Promise<MembershipPlan[]> {
  return prisma.membershipPlan.findMany({
    where: { isActive: true },
    orderBy: { priceCents: "asc" },
  });
}

export async function findPlanByCode(code: string): Promise<MembershipPlan | null> {
  return prisma.membershipPlan.findUnique({ where: { code } });
}

export async function findPlanById(id: string): Promise<MembershipPlan | null> {
  return prisma.membershipPlan.findUnique({ where: { id } });
}

export async function createUserMembership(
  userId: string,
  planId: string,
  source: string = "trial",
  durationDays?: number,
): Promise<UserMembership> {
  const plan = await findPlanById(planId);
  if (!plan) {
    throw new Error("Plan not found");
  }

  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + (durationDays ?? plan.durationDays));

  return prisma.userMembership.create({
    data: {
      userId,
      planId,
      startsAt: now,
      expiresAt,
      status: "active",
      source,
    },
  });
}

export async function findActiveMembership(
  userId: string,
): Promise<(UserMembership & { plan: MembershipPlan }) | null> {
  return prisma.userMembership.findFirst({
    where: {
      userId,
      status: "active",
      expiresAt: { gt: new Date() },
    },
    include: { plan: true },
    orderBy: { expiresAt: "desc" },
  });
}

export function getPlanCapabilities(plan: MembershipPlan): PlanCapabilities {
  return (plan.capabilities as PlanCapabilities) ?? {};
}
