import { prisma } from "@/lib/db";
import type { ReferralCommission, WithdrawalRequest } from "@/lib/generated/prisma/client";

export async function getReferralSummary(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("用户不存在");

  const invitedCount = await prisma.user.count({ where: { referredByUserId: userId } });
  const commissions = await prisma.referralCommission.findMany({
    where: { referrerUserId: userId },
  });
  const totalCommission = commissions.reduce((s, c) => s + c.amountCents, 0);
  const withdrawnCents = commissions.filter(c => c.status === "withdrawn").reduce((s, c) => s + c.amountCents, 0);

  // available = available commissions minus pending/approved withdrawals
  const availableComm = commissions.filter(c => c.status === "available").reduce((s, c) => s + c.amountCents, 0);
  const pendingWithdrawals = await prisma.withdrawalRequest.findMany({
    where: { userId, status: "pending" },
  });
  const pendingWithdrawalCents = pendingWithdrawals.reduce((s, w) => s + w.amountCents, 0);
  const availableCents = availableComm - pendingWithdrawalCents;

  return {
    referralCode: user.referralCode,
    referralUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/register?ref=${user.referralCode}`,
    invitedCount,
    totalOrders: commissions.length,
    totalCommission,
    availableCents: Math.max(0, availableCents),
    withdrawnCents,
  };
}

export async function listReferralUsers(userId: string) {
  return prisma.user.findMany({ where: { referredByUserId: userId }, select: { id: true, username: true, createdAt: true } });
}

export async function listCommissions(userId: string): Promise<ReferralCommission[]> {
  return prisma.referralCommission.findMany({ where: { referrerUserId: userId }, orderBy: { createdAt: "desc" }, include: { referred: { select: { username: true } }, order: { select: { orderNo: true, amountCents: true } } } });
}

export async function createWithdrawal(userId: string, input: { amountCents: number; alipayName: string; alipayAccount: string }): Promise<WithdrawalRequest> {
  const { availableCents } = await getReferralSummary(userId);
  if (input.amountCents > availableCents) throw new Error("可提现金额不足（含未处理的提现申请）");
  if (!input.alipayName || !input.alipayAccount) throw new Error("请填写支付宝信息");
  return prisma.withdrawalRequest.create({
    data: { userId, amountCents: input.amountCents, alipayName: input.alipayName, alipayAccount: input.alipayAccount, status: "pending" },
  });
}

export async function listWithdrawals(userId: string): Promise<WithdrawalRequest[]> {
  return prisma.withdrawalRequest.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
}
