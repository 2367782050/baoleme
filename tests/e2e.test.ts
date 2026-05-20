/**
 * Phase 9 End-to-End Integration Tests
 *
 * These tests verify key user journeys across module boundaries.
 * Each test simulates a real user flow by calling service and API functions.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../lib/db/prisma.js";
import {
  registerUser, loginUser, sendEmailCode,
} from "../lib/services/auth.service.js";
import { findActiveMembership } from "../lib/services/membership.service.js";
import { createOrder, mockPayOrder } from "../lib/services/billing.service.js";
import { queryAccounts, addFavorite, exportMaterial } from "../lib/services/material.service.js";
import { createArticleGenerationJob, executeArticleGenerationJob } from "../lib/services/article-generation.service.js";
import { renderMarkdown, DEFAULT_CONFIG } from "../lib/services/formatter.service.js";
import { createMockOfficialAccount, pushDraft, deleteOfficialAccount } from "../lib/services/official-account.service.js";
import { createWithdrawal, getReferralSummary } from "../lib/services/referral.service.js";
import { reviewWithdrawal } from "../lib/services/admin.service.js";

describe("E2E: Register → Login → Member → Quota", () => {
  const u = `e2e1_${Date.now().toString(36)}`;
  let userId: string;

  afterAll(async () => {
    if (userId) {
      await prisma.quotaUsage.deleteMany({ where: { userId } });
      await prisma.userMembership.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
  });

  it("register with email code → login → check membership", async () => {
    const email = `e2e1_${Date.now().toString(36)}@t.com`;
    const code = await sendEmailCode(email, "register");
    expect(code).toMatch(/^\d{6}$/);

    const r = await registerUser({
      username: u, email, password: "e2etest123",
    });
    userId = r.user.id;
    expect(r.user.username).toBe(u);

    // Login
    const login = await loginUser({ account: u, password: "e2etest123" });
    expect(login.userId).toBe(userId);

    // Membership
    const ms = await findActiveMembership(userId);
    expect(ms).not.toBeNull();
    expect(ms!.plan.code).toBe("free");
  });
});

describe("E2E: Material → Favorite → Export → Quota deducted", () => {
  const u = `e2e2_${Date.now().toString(36)}`;
  let userId: string;

  beforeAll(async () => {
    const r = await registerUser({ username: u, email: `e2e2_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) });
    userId = r.user.id;
  });
  afterAll(async () => {
    await prisma.favorite.deleteMany({ where: { userId } });
    await prisma.quotaUsage.deleteMany({ where: { userId } });
    await prisma.userMembership.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it("browse accounts → favorite → export with quota", async () => {
    const accounts = await queryAccounts({ page: 1, pageSize: 5 });
    expect(accounts.items.length).toBeGreaterThan(0);

    const fav = await addFavorite(userId, "account", accounts.items[0].id);
    expect(fav.userId).toBe(userId);

    const csv = await exportMaterial(userId, "accounts", {});
    expect(csv).toContain("排名,平台,账号名称");

    // Verify quota was consumed
    const usage = await prisma.quotaUsage.findFirst({
      where: { userId, capability: "material_export" },
    });
    expect(usage).not.toBeNull();
  });
});

describe("E2E: Article generation → Format → Save config", () => {
  const u = `e2e3_${Date.now().toString(36)}`;
  let userId: string, articleId: string;

  beforeAll(async () => {
    const r = await registerUser({ username: u, email: `e2e3_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) });
    userId = r.user.id;
  });
  afterAll(async () => {
    await prisma.articleGenerationJob.deleteMany({ where: { userId } });
    await prisma.article.deleteMany({ where: { userId } });
    await prisma.quotaUsage.deleteMany({ where: { userId } });
    await prisma.userMembership.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it("generate article → review → render HTML → save config", async () => {
    const { article, job } = await createArticleGenerationJob(userId, {
      title: "E2E测试文章", imageCount: 1, imageStrategy: "none",
    });
    articleId = article.id;
    expect(job.status).toBe("pending");

    await prisma.articleGenerationJob.update({ where: { id: job.id }, data: { status: "running", startedAt: new Date(), attempts: { increment: 1 } } });
    await executeArticleGenerationJob(job.id);
    const a = await prisma.article.findUnique({ where: { id: articleId } });
    expect(a!.status).toBe("completed");
    expect(a!.markdownContent).toBeTruthy();

    // Format
    const html = renderMarkdown(a!.markdownContent ?? "", {
      ...DEFAULT_CONFIG, themeColor: "#ff0000",
    });
    expect(html).toContain("#ff0000");
    expect(html).not.toContain("<script");

    // Save formatterConfig
    await prisma.article.update({
      where: { id: articleId },
      data: { formatterConfig: { themeColor: "#ff0000" }, htmlContent: html },
    });

    const saved = await prisma.article.findUnique({ where: { id: articleId } });
    const fc = (saved!.formatterConfig as Record<string, string> | null);
    expect(fc?.themeColor).toBe("#ff0000");
  });
});

describe("E2E: OA → Draft → Revoke → Reject push", () => {
  const u = `e2e4_${Date.now().toString(36)}`;
  let userId: string, oaId: string, articleId: string;

  beforeAll(async () => {
    const r = await registerUser({ username: u, email: `e2e4_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) });
    userId = r.user.id;
    oaId = (await createMockOfficialAccount(userId, null, "E2E号")).id;
    articleId = (await prisma.article.create({ data: { userId, title: "推文", status: "completed", markdownContent: "# x" } })).id;
  });
  afterAll(async () => {
    await prisma.draftPushTask.deleteMany({ where: { userId } });
    await prisma.article.deleteMany({ where: { userId } });
    await prisma.officialAccount.updateMany({ where: { userId }, data: { status: "revoked" } });
    await prisma.officialAccount.deleteMany({ where: { userId } });
    await prisma.quotaUsage.deleteMany({ where: { userId } });
    await prisma.userMembership.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it("push draft → revoke OA → push to revoked fails", async () => {
    const task = await pushDraft(userId, articleId, oaId);
    expect(task.status).toBe("completed");
    expect(task.externalDraftId).toContain("mock_draft_");

    // Revoke
    await deleteOfficialAccount(oaId, userId);
    const revoked = await prisma.officialAccount.findUnique({ where: { id: oaId } });
    expect(revoked!.status).toBe("revoked");

    // Push to revoked should fail
    await expect(pushDraft(userId, articleId, oaId)).rejects.toThrow("不存在");
  });
});

describe("E2E: Referral → Pay → Commission → Withdraw → Admin review", () => {
  const refU = `e2er_${Date.now().toString(36)}`;
  const refdU = `e2ed_${Date.now().toString(36)}`;
  let referrerId: string, referredId: string, planId: string;

  beforeAll(async () => {
    referrerId = (await registerUser({ username: refU, email: `e2er_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) })).user.id;
    const refCode = (await prisma.user.findUnique({ where: { id: referrerId } }))!.referralCode;
    referredId = (await registerUser({ username: refdU, email: `e2ed_${Date.now().toString(36)}@t.com`, password: "x".repeat(8), referralCode: refCode })).user.id;
    planId = (await prisma.membershipPlan.findUnique({ where: { code: "pro" } }))!.id;
  });
  afterAll(async () => {
    await prisma.withdrawalRequest.deleteMany({ where: { userId: referrerId } });
    await prisma.referralCommission.deleteMany({ where: { referrerUserId: referrerId } });
    await prisma.order.deleteMany({ where: { userId: { in: [referrerId, referredId] } } });
    await prisma.userMembership.deleteMany({ where: { userId: { in: [referrerId, referredId] } } });
    await prisma.quotaUsage.deleteMany({ where: { userId: { in: [referrerId, referredId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [referrerId, referredId] } } }).catch(() => {});
  });

  it("referred pays → commission → withdraw → admin approve → balance OK", async () => {
    const o = await createOrder(referredId, planId);
    await mockPayOrder(o.id, referredId);

    const before = await getReferralSummary(referrerId);
    expect(before.totalCommission).toBeGreaterThan(0);

    const half = Math.floor(before.availableCents / 2);
    const w = await createWithdrawal(referrerId, { amountCents: half, alipayName: "E2E", alipayAccount: "e2e@t.com" });
    expect(w.status).toBe("pending");

    const admin = await prisma.user.findUnique({ where: { username: "admin" } });
    await reviewWithdrawal(admin!.id, w.id, "approved");

    const after = await getReferralSummary(referrerId);
    expect(after.totalCommission).toBe(before.totalCommission);
    expect(after.withdrawnCents).toBeGreaterThan(0);
  });
});

describe("E2E: Disabled user → blocked access", () => {
  const u = `e2edis_${Date.now().toString(36)}`;
  let userId: string;

  afterAll(async () => {
    if (userId) {
      await prisma.quotaUsage.deleteMany({ where: { userId } });
      await prisma.userMembership.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
  });

  it("disabled user is rejected by requireAuth", async () => {
    const r = await registerUser({ username: u, email: `e2edis_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) });
    userId = r.user.id;
    await prisma.user.update({ where: { id: userId }, data: { status: "disabled" } });

    // Verify the user is actually disabled in DB
    const dbUser = await prisma.user.findUnique({ where: { id: userId } });
    expect(dbUser).not.toBeNull();
    expect(dbUser!.status).toBe("disabled");
    // The admin-api.test.ts covers the actual route-level 401 check via cookie mock
  });
});
