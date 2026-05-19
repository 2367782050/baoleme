import { prisma } from "@/lib/db";
import type { OfficialAccount, DraftPushTask } from "@/lib/generated/prisma/client";
import { findActiveMembership, getPlanCapabilities } from "./membership.service";
import { consume, QuotaExceededError } from "./quota.service";
import { mockWeChatDraftAdapter } from "@/lib/adapters/wechat";

// ─── Mock Official Accounts CRUD ───────────────────────────────

export async function createMockOfficialAccount(
  userId: string, groupId: string | null, name: string, appid?: string,
): Promise<OfficialAccount> {
  // Check current count against plan limit
  const currentCount = await prisma.officialAccount.count({
    where: { userId, status: { notIn: ["revoked"] } },
  });
  const membership = await findActiveMembership(userId);
  const limit = membership ? (getPlanCapabilities(membership.plan).official_account_limit ?? 1) : 1;
  if (currentCount >= limit) {
    throw new OfficialAccountQuotaExceededError(`公众号数量已达上限（${limit}）`);
  }

  const appId = appid ?? `mock_appid_${Date.now().toString(36)}`;
  return prisma.officialAccount.create({
    data: { userId, groupId, appid: appId, name, status: "mock_authorized" },
  });
}

export async function listOfficialAccounts(
  userId: string, groupId?: string,
): Promise<OfficialAccount[]> {
  const where: { userId: string; groupId?: string; status?: { notIn: string[] } } = {
    userId, status: { notIn: ["revoked"] },
  };
  if (groupId) where.groupId = groupId;
  return prisma.officialAccount.findMany({ where, include: { group: true }, orderBy: { createdAt: "desc" } });
}

export async function getOfficialAccount(accountId: string, userId: string): Promise<OfficialAccount | null> {
  const a = await prisma.officialAccount.findUnique({ where: { id: accountId }, include: { group: true } });
  if (!a || a.userId !== userId) return null;
  if (a.status === "revoked") return null;
  return a;
}

export async function deleteOfficialAccount(accountId: string, userId: string): Promise<void> {
  const a = await prisma.officialAccount.findUnique({ where: { id: accountId } });
  if (!a || a.userId !== userId) throw new OfficialAccountNotFoundError("公众号不存在");

  // Check if there are associated draft push tasks
  const draftCount = await prisma.draftPushTask.count({ where: { officialAccountId: accountId } });
  if (draftCount > 0) {
    // Soft-delete: mark as revoked, keep history
    await prisma.officialAccount.update({ where: { id: accountId }, data: { status: "revoked" } });
  } else {
    await prisma.officialAccount.delete({ where: { id: accountId } });
  }
}

// ─── Draft Push ────────────────────────────────────────────────

export async function pushDraft(
  userId: string, articleId: string, officialAccountId: string,
): Promise<DraftPushTask> {
  await prisma.quotaUsage.findFirst({ where: { userId } }); // ensure user exists

  const article = await prisma.article.findUnique({ where: { id: articleId } });
  if (!article || article.userId !== userId) throw new Error("文章不存在");

  const oa = await getOfficialAccount(officialAccountId, userId);
  if (!oa) throw new Error("公众号不存在");

  // Check draft_push quota
  const membership = await findActiveMembership(userId);
  const limit = membership ? (getPlanCapabilities(membership.plan).draft_push_daily ?? 0) : 0;
  const today = new Date().toISOString().substring(0, 10);
  const used = await prisma.quotaUsage.findUnique({
    where: { userId_capability_periodType_periodKey: { userId, capability: "draft_push", periodType: "daily", periodKey: today } },
  });
  if ((used?.used ?? 0) >= limit) throw new QuotaExceededError("draft_push", "推送配额已用完");

  const task = await prisma.draftPushTask.create({
    data: { userId, articleId, officialAccountId, status: "pending" },
  });

  await prisma.draftPushTask.update({ where: { id: task.id }, data: { status: "running" } });

  try {
    const result = await mockWeChatDraftAdapter.pushDraft({ articleId, officialAccountId, userId });
    const finalStatus = result.status === "success" ? "completed" : "failed";
    await prisma.draftPushTask.update({
      where: { id: task.id },
      data: { status: finalStatus, externalDraftId: result.externalDraftId, errorMessage: result.status === "failed" ? result.message : null },
    });
    await consume(userId, "draft_push", 1);
  } catch (e) {
    await prisma.draftPushTask.update({
      where: { id: task.id },
      data: { status: "failed", errorMessage: (e as Error).message },
    });
  }

  return prisma.draftPushTask.findUnique({ where: { id: task.id } }) as Promise<DraftPushTask>;
}

export async function listDraftPushTasks(userId: string, articleId?: string): Promise<DraftPushTask[]> {
  const where: { userId: string; articleId?: string } = { userId };
  if (articleId) where.articleId = articleId;
  return prisma.draftPushTask.findMany({ where, orderBy: { createdAt: "desc" }, include: { officialAccount: true, article: true } });
}

export class OfficialAccountNotFoundError extends Error { code = "NOT_FOUND"; constructor(m: string) { super(m); this.name = "OfficialAccountNotFoundError"; } }
export class OfficialAccountQuotaExceededError extends Error { code = "QUOTA_EXCEEDED"; constructor(m: string) { super(m); this.name = "OfficialAccountQuotaExceededError"; } }
export { QuotaExceededError };
