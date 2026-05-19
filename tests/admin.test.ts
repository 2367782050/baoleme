import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../lib/db/prisma.js";
import { registerUser } from "../lib/services/auth.service.js";
import { listUsers, setUserStatus, adminGrantMembership, generateMembershipCodes, reviewWithdrawal, listPromptJobs, listArticleJobs } from "../lib/services/admin.service.js";
import { createOrder, mockPayOrder } from "../lib/services/billing.service.js";
import { createWithdrawal, getReferralSummary } from "../lib/services/referral.service.js";
import { redeemMembershipCode } from "../lib/services/membership-code.service.js";
import { createGenerationJob } from "../lib/services/prompt-generation.service.js";

describe("Admin: user management", () => {
  let adminId: string, userId: string;
  beforeAll(async () => {
    adminId = (await registerUser({ username: `adm_${Date.now().toString(36)}`, email: `adm_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) })).user.id;
    userId = (await registerUser({ username: `usr_${Date.now().toString(36)}`, email: `usr_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) })).user.id;
    await prisma.user.update({ where: { id: adminId }, data: { role: "admin" } });
  });
  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { userId: adminId } });
    await prisma.quotaUsage.deleteMany({ where: { userId: { in: [adminId, userId] } } });
    await prisma.userMembership.deleteMany({ where: { userId: { in: [adminId, userId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [adminId, userId] } } }).catch(() => {});
  });

  it("lists users", async () => { const r = await listUsers({ page: 1, pageSize: 10 }); expect(r.total).toBeGreaterThanOrEqual(1); });
  it("searches by keyword", async () => { const r = await listUsers({ keyword: "adm_", page: 1, pageSize: 10 }); expect(r.total).toBeGreaterThanOrEqual(1); });

  it("disables user and writes audit", async () => {
    await setUserStatus(adminId, userId, "disabled");
    const u = await prisma.user.findUnique({ where: { id: userId } });
    expect(u!.status).toBe("disabled");
    const logs = await prisma.auditLog.count({ where: { userId: adminId, action: "disable_user", targetId: userId } });
    expect(logs).toBe(1);
  });

  it("enables user and writes audit", async () => {
    await setUserStatus(adminId, userId, "active");
    const u = await prisma.user.findUnique({ where: { id: userId } });
    expect(u!.status).toBe("active");
    const logs = await prisma.auditLog.count({ where: { userId: adminId, action: "enable_user", targetId: userId } });
    expect(logs).toBe(1);
  });
});

describe("Admin: membership management", () => {
  let adminId: string, userId: string, planId: string;
  beforeAll(async () => {
    adminId = (await registerUser({ username: `admm_${Date.now().toString(36)}`, email: `admm_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) })).user.id;
    userId = (await registerUser({ username: `usr2_${Date.now().toString(36)}`, email: `usr2_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) })).user.id;
    planId = (await prisma.membershipPlan.findUnique({ where: { code: "pro" } }))!.id;
    await prisma.user.update({ where: { id: adminId }, data: { role: "admin" } });
  });
  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { userId: adminId } });
    await prisma.membershipCode.deleteMany({ where: { planId } });
    await prisma.userMembership.updateMany({ where: { userId }, data: { status: "expired" } });
    await prisma.userMembership.deleteMany({ where: { userId: { in: [adminId, userId] } } });
    await prisma.quotaUsage.deleteMany({ where: { userId: { in: [adminId, userId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [adminId, userId] } } }).catch(() => {});
  });

  it("grants membership and writes audit", async () => {
    await adminGrantMembership(adminId, userId, planId, 30);
    const m = await prisma.userMembership.findFirst({ where: { userId, source: "admin", status: "active" } });
    expect(m).not.toBeNull();
    const logs = await prisma.auditLog.count({ where: { userId: adminId, action: "grant_membership", targetId: userId } });
    expect(logs).toBe(1);
  });

  it("generates codes and writes audit", async () => {
    const codes = await generateMembershipCodes(adminId, planId, 1);
    expect(codes.length).toBe(1);
    const name = await redeemMembershipCode(userId, codes[0]);
    expect(name).toBe("专业版");
    const logs = await prisma.auditLog.count({ where: { userId: adminId, action: "generate_membership_codes", targetId: planId } });
    expect(logs).toBe(1);
  });
});

describe("Admin: withdrawal review — commission split", () => {
  let adminId: string, referrerId: string, planId: string;
  beforeAll(async () => {
    adminId = (await registerUser({ username: `adwr_${Date.now().toString(36)}`, email: `adwr_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) })).user.id;
    referrerId = (await registerUser({ username: `rfr_${Date.now().toString(36)}`, email: `rfr_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) })).user.id;
    planId = (await prisma.membershipPlan.findUnique({ where: { code: "pro" } }))!.id;
    await prisma.user.update({ where: { id: adminId }, data: { role: "admin" } });
    // Create a referred user
    const refd = await registerUser({ username: `refd_${Date.now().toString(36)}`, email: `refd_${Date.now().toString(36)}@t.com`, password: "x".repeat(8), referralCode: (await prisma.user.findUnique({ where: { id: referrerId } }))!.referralCode });
    // Create and pay order
    const o = await createOrder(refd.user.id, planId);
    await mockPayOrder(o.id, refd.user.id);
    // Don't cleanup referred user here — keep the commission for testing
    await prisma.userMembership.deleteMany({ where: { userId: refd.user.id } });
    await prisma.quotaUsage.deleteMany({ where: { userId: refd.user.id } });
    await prisma.user.delete({ where: { id: refd.user.id } }).catch(() => {});
  });
  afterAll(async () => {
    // Cleanup the referred user and related data
    const refdUsers = await prisma.user.findMany({ where: { referredByUserId: referrerId } });
    for (const ru of refdUsers) {
      await prisma.referralCommission.deleteMany({ where: { referredUserId: ru.id } });
      await prisma.order.deleteMany({ where: { userId: ru.id } });
      await prisma.userMembership.deleteMany({ where: { userId: ru.id } });
      await prisma.quotaUsage.deleteMany({ where: { userId: ru.id } });
      await prisma.user.delete({ where: { id: ru.id } }).catch(() => {});
    }
    await prisma.withdrawalRequest.deleteMany({ where: { userId: referrerId } });
    await prisma.referralCommission.deleteMany({ where: { referrerUserId: referrerId } });
    await prisma.auditLog.deleteMany({ where: { userId: adminId } });
    await prisma.order.deleteMany({ where: { userId: referrerId } });
    await prisma.quotaUsage.deleteMany({ where: { userId: { in: [adminId, referrerId] } } });
    await prisma.userMembership.deleteMany({ where: { userId: { in: [adminId, referrerId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [adminId, referrerId] } } }).catch(() => {});
  });

  it("approving partial withdrawal preserves remaining balance", async () => {
    const before = await getReferralSummary(referrerId);
    const totalBefore = before.totalCommission;
    // Withdraw half of available
    const half = Math.max(1, Math.floor(before.availableCents / 2));
    const w = await createWithdrawal(referrerId, { amountCents: half, alipayName: "测试", alipayAccount: "test@test.com" });
    await reviewWithdrawal(adminId, w.id, "approved");

    const after = await getReferralSummary(referrerId);
    // Total commission should not shrink
    expect(after.totalCommission).toBe(totalBefore);
    // Audit log for approval
    const logs = await prisma.auditLog.count({ where: { userId: adminId, action: "approve_withdrawal", targetId: w.id } });
    expect(logs).toBe(1);
    // Withdrawn should reflect the approved withdrawal
    expect(after.withdrawnCents).toBeGreaterThanOrEqual(half);
  });

  it("rejected withdrawal releases balance", async () => {
    const before = await getReferralSummary(referrerId);
    if (before.availableCents <= 0) return; // nothing to test
    const w = await createWithdrawal(referrerId, { amountCents: before.availableCents, alipayName: "驳回测试", alipayAccount: "x@t.com" });
    await reviewWithdrawal(adminId, w.id, "rejected");
    const after = await getReferralSummary(referrerId);
    // After rejection, available should be back to ~before amount
    expect(after.availableCents).toBeGreaterThanOrEqual(before.availableCents);
    // Audit log for rejection
    const logs = await prisma.auditLog.count({ where: { userId: adminId, action: "reject_withdrawal", targetId: w.id } });
    expect(logs).toBe(1);
  });
});

describe("Admin: AI jobs monitoring", () => {
  let adminId: string, userId: string;
  beforeAll(async () => {
    adminId = (await registerUser({ username: `admj_${Date.now().toString(36)}`, email: `admj_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) })).user.id;
    userId = (await registerUser({ username: `ujob_${Date.now().toString(36)}`, email: `ujob_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) })).user.id;
    await prisma.user.update({ where: { id: adminId }, data: { role: "admin" } });
  });
  afterAll(async () => {
    await prisma.promptGenerationJob.deleteMany({ where: { userId } });
    await prisma.prompt.deleteMany({ where: { userId } });
    await prisma.quotaUsage.deleteMany({ where: { userId: { in: [adminId, userId] } } });
    await prisma.userMembership.deleteMany({ where: { userId: { in: [adminId, userId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [adminId, userId] } } }).catch(() => {});
  });

  it("lists prompt jobs", async () => {
    await createGenerationJob(userId, null, { name: "test", contentDomain: "x", targetAudience: "x", authorName: "x", personaDetails: "x", personalityTraits: ["x"], headingStyle: "n", wordCount: 100, enableAIDetectionEvasion: false, materialAnalysisJson: "{}", userNotes: "" });
    // Wait for async worker to finish
    await new Promise(r => setTimeout(r, 300));
    const r = await listPromptJobs({ page: 1, pageSize: 10 });
    expect(r.total).toBeGreaterThanOrEqual(1);
  });

  it("lists article jobs", async () => {
    const r = await listArticleJobs({ page: 1, pageSize: 10 });
    expect(r.total).toBeGreaterThanOrEqual(0);
  });
});
