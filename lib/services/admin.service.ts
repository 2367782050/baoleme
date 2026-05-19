import { prisma } from "@/lib/db";
import { writeAuditLog } from "./audit.service";
import crypto from "node:crypto";

// ─── User management ───────────────────────────────────────

export async function listUsers(params: { keyword?: string; page: number; pageSize: number }) {
  const where: Record<string, unknown> = {};
  if (params.keyword) {
    where.OR = [
      { username: { contains: params.keyword, mode: "insensitive" } },
      { email: { contains: params.keyword, mode: "insensitive" } },
    ];
  }
  const items = await prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: (params.page - 1) * params.pageSize, take: params.pageSize, select: { id: true, username: true, email: true, role: true, status: true, referralCode: true, referredByUserId: true, createdAt: true, lastLoginAt: true } });
  const total = await prisma.user.count({ where });
  return { items, total };
}

export async function setUserStatus(adminUserId: string, targetUserId: string, status: "active" | "disabled") {
  const u = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!u) throw new Error("用户不存在");
  await prisma.user.update({ where: { id: targetUserId }, data: { status } });
  await writeAuditLog({ userId: adminUserId, action: status === "active" ? "enable_user" : "disable_user", targetType: "user", targetId: targetUserId, metadata: { previous: u.status } });
}

// ─── Membership management ─────────────────────────────────

export async function adminGrantMembership(adminUserId: string, targetUserId: string, planId: string, durationDays?: number) {
  const plan = await prisma.membershipPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error("套餐不存在");
  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) throw new Error("用户不存在");

  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + (durationDays ?? plan.durationDays));

  await prisma.userMembership.updateMany({ where: { userId: targetUserId, status: "active" }, data: { status: "expired" } });
  await prisma.userMembership.create({ data: { userId: targetUserId, planId, startsAt: now, expiresAt, status: "active", source: "admin" } });

  await writeAuditLog({ userId: adminUserId, action: "grant_membership", targetType: "user", targetId: targetUserId, metadata: { planId, durationDays: durationDays ?? plan.durationDays } });
}

export async function generateMembershipCodes(adminUserId: string, planId: string, count: number, expiresAt?: string) {
  const plan = await prisma.membershipPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error("套餐不存在");

  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = `VIP${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const codeHash = crypto.createHash("sha256").update(code).digest("hex");
    await prisma.membershipCode.create({ data: { codeHash, planId, status: "unused", expiresAt: expiresAt ? new Date(expiresAt) : undefined } });
    codes.push(code);
  }

  await writeAuditLog({ userId: adminUserId, action: "generate_membership_codes", targetType: "membership_plan", targetId: planId, metadata: { count, expiresAt } });

  return codes;
}

// ─── Order management ──────────────────────────────────────

export async function listAllOrders(params: { status?: string; page: number; pageSize: number }) {
  const where: Record<string, unknown> = {};
  if (params.status) where.status = params.status;
  const items = await prisma.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (params.page - 1) * params.pageSize, take: params.pageSize, include: { user: { select: { username: true } }, plan: { select: { name: true } } } });
  const total = await prisma.order.count({ where });
  return { items, total };
}

// ─── Withdrawal review ─────────────────────────────────────

export async function listAllWithdrawals(params: { status?: string; page: number; pageSize: number }) {
  const where: Record<string, unknown> = {};
  if (params.status) where.status = params.status;
  const items = await prisma.withdrawalRequest.findMany({ where, orderBy: { createdAt: "desc" }, skip: (params.page - 1) * params.pageSize, take: params.pageSize, include: { user: { select: { username: true } } } });
  const total = await prisma.withdrawalRequest.count({ where });
  return { items, total };
}

export async function reviewWithdrawal(adminUserId: string, withdrawalId: string, action: "approved" | "rejected") {
  const w = await prisma.withdrawalRequest.findUnique({ where: { id: withdrawalId } });
  if (!w) throw new Error("提现申请不存在");
  if (w.status !== "pending") throw new Error("只能审核待处理的提现申请");

  await prisma.withdrawalRequest.update({ where: { id: withdrawalId }, data: { status: action, reviewedByUserId: adminUserId, reviewedAt: new Date() } });

  // If approved, mark related commissions as withdrawn
  if (action === "approved") {
    const commissions = await prisma.referralCommission.findMany({
      where: { referrerUserId: w.userId, status: "available" },
      orderBy: { createdAt: "asc" },
    });
    let remaining = w.amountCents;
    for (const c of commissions) {
      if (remaining <= 0) break;
      const deduct = Math.min(c.amountCents, remaining);
      if (deduct >= c.amountCents) {
        // Entire commission is withdrawn
        await prisma.referralCommission.update({ where: { id: c.id }, data: { status: "withdrawn" } });
      } else {
        // Partial: reduce available commission, create a withdrawn record for the deduct
        await prisma.referralCommission.update({ where: { id: c.id }, data: { amountCents: c.amountCents - deduct } });
        // Create a withdrawn record for the deduct portion
        await prisma.referralCommission.create({
          data: { referrerUserId: c.referrerUserId, referredUserId: c.referredUserId, orderId: c.orderId, amountCents: deduct, rate: c.rate, status: "withdrawn" },
        });
      }
      remaining -= deduct;
    }
  }

  await writeAuditLog({ userId: adminUserId, action: action === "approved" ? "approve_withdrawal" : "reject_withdrawal", targetType: "withdrawal", targetId: withdrawalId, metadata: { action, amountCents: w.amountCents } });
}

// ─── AI Jobs monitoring ────────────────────────────────────

export async function listPromptJobs(params: { status?: string; page: number; pageSize: number }) {
  const where: Record<string, unknown> = {};
  if (params.status) where.status = params.status;
  const items = await prisma.promptGenerationJob.findMany({ where, orderBy: { createdAt: "desc" }, skip: (params.page - 1) * params.pageSize, take: params.pageSize, include: { user: { select: { username: true } } } });
  const total = await prisma.promptGenerationJob.count({ where });
  return { items, total };
}

export async function listArticleJobs(params: { status?: string; page: number; pageSize: number }) {
  const where: Record<string, unknown> = {};
  if (params.status) where.status = params.status;
  const items = await prisma.articleGenerationJob.findMany({ where, orderBy: { createdAt: "desc" }, skip: (params.page - 1) * params.pageSize, take: params.pageSize, include: { user: { select: { username: true } }, article: { select: { title: true } } } });
  const total = await prisma.articleGenerationJob.count({ where });
  return { items, total };
}
