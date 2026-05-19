import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { findPlanById } from "./membership.service";

export async function redeemMembershipCode(userId: string, code: string): Promise<string> {
  const codeHash = crypto.createHash("sha256").update(code).digest("hex");
  const mc = await prisma.membershipCode.findFirst({ where: { codeHash, status: "unused" } });
  if (!mc) throw new Error("会员码无效或已使用");
  if (mc.expiresAt && new Date(mc.expiresAt) < new Date()) throw new Error("会员码已过期");

  const plan = await findPlanById(mc.planId);
  if (!plan) throw new Error("套餐不存在");

  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + plan.durationDays);

  // Deactivate current active memberships
  await prisma.userMembership.updateMany({ where: { userId, status: "active" }, data: { status: "expired" } });
  await prisma.userMembership.create({
    data: { userId, planId: mc.planId, startsAt: now, expiresAt, status: "active", source: "code" },
  });

  await prisma.membershipCode.update({ where: { id: mc.id }, data: { status: "used", usedByUserId: userId, usedAt: now } });

  return plan.name;
}
