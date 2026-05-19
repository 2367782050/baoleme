import { prisma } from "@/lib/db";
import type { Order } from "@/lib/generated/prisma/client";
import { mockBillingAdapter } from "@/lib/adapters/billing";
import { findPlanById } from "./membership.service";

export async function createOrder(userId: string, planId: string): Promise<Order> {
  const plan = await findPlanById(planId);
  if (!plan) throw new Error("套餐不存在");
  const { orderNo } = await mockBillingAdapter.createOrder({ userId, planId, amountCents: plan.priceCents });
  return prisma.order.create({
    data: { userId, planId, orderNo, amountCents: plan.priceCents, status: "pending", paymentProvider: "mock" },
  });
}

export async function listOrders(userId: string): Promise<Order[]> {
  return prisma.order.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, include: { plan: true } });
}

export async function mockPayOrder(orderId: string, userId: string): Promise<Order> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.userId !== userId) throw new Error("订单不存在");
  if (order.status === "paid") throw new Error("订单已支付，不可重复支付");

  const result = await mockBillingAdapter.payOrder(order.orderNo);
  if (result.status !== "paid") throw new Error(result.message);

  const now = new Date();
  await prisma.order.update({ where: { id: orderId }, data: { status: "paid", paidAt: now } });

  // Activate membership
  const plan = await findPlanById(order.planId);
  if (!plan) throw new Error("套餐不存在");

  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + plan.durationDays);

  // Deactivate any current active memberships
  await prisma.userMembership.updateMany({
    where: { userId, status: "active" },
    data: { status: "expired" },
  });

  await prisma.userMembership.create({
    data: { userId, planId: order.planId, startsAt: now, expiresAt, status: "active", source: "order" },
  });

  // Generate commission if user was referred
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user?.referredByUserId) {
    const rate = 0.2; // 20% commission rate
    const amountCents = Math.floor(order.amountCents * rate);
    await prisma.referralCommission.create({
      data: { referrerUserId: user.referredByUserId, referredUserId: userId, orderId, amountCents, rate, status: "available" },
    });
  }

  return prisma.order.findUnique({ where: { id: orderId } }) as Promise<Order>;
}
