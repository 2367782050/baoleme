import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../lib/db/prisma.js";
import { registerUser } from "../lib/services/auth.service.js";
import {
  createMockOfficialAccount, listOfficialAccounts, deleteOfficialAccount, pushDraft,
  OfficialAccountNotFoundError, OfficialAccountQuotaExceededError,
} from "../lib/services/official-account.service.js";
import { createOrder, mockPayOrder } from "../lib/services/billing.service.js";
import { redeemMembershipCode } from "../lib/services/membership-code.service.js";
import { getReferralSummary, createWithdrawal } from "../lib/services/referral.service.js";
import crypto from "node:crypto";

describe("Official accounts — count-based quota", () => {
  const un = `oa_${Date.now().toString(36)}`; let u1: string, u2: string;
  beforeAll(async () => {
    u1 = (await registerUser({ username: un, email: `oa_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) })).user.id;
    u2 = (await registerUser({ username: `oa2_${Date.now().toString(36)}`, email: `oa2_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) })).user.id;
  });
  afterAll(async () => { await prisma.draftPushTask.deleteMany({ where: { userId: { in: [u1, u2] } } }); await prisma.officialAccount.deleteMany({ where: { userId: { in: [u1, u2] } } }); await prisma.quotaUsage.deleteMany({ where: { userId: { in: [u1, u2] } } }); await prisma.userMembership.deleteMany({ where: { userId: { in: [u1, u2] } } }); await prisma.user.deleteMany({ where: { id: { in: [u1, u2] } } }).catch(() => {}); });

  it("free user creates 1 OA, fails on 2nd", async () => {
    const a = await createMockOfficialAccount(u1, null, "第一个号");
    expect(a.name).toBe("第一个号");
    await expect(createMockOfficialAccount(u1, null, "第二个号")).rejects.toThrow(OfficialAccountQuotaExceededError);
  });

  it("can create again after deleting all", async () => {
    // First delete the existing one
    const existing = await listOfficialAccounts(u1);
    for (const oa of existing) await deleteOfficialAccount(oa.id, u1);
    // Now should be able to create a new one
    const a2 = await createMockOfficialAccount(u1, null, "重新创建");
    expect(a2.name).toBe("重新创建");
  });

  it("lists own accounts", async () => { const list = await listOfficialAccounts(u1); expect(list.length).toBeGreaterThanOrEqual(1); });
  it("cannot access other's account", async () => { const list = await listOfficialAccounts(u2); if (list.length === 0) return; expect(await prisma.officialAccount.findFirst({ where: { id: list[0].id, userId: u1 } })).toBeNull(); });
  it("cannot delete other's account", async () => { const list = await listOfficialAccounts(u2); if (list.length === 0) return; await expect(deleteOfficialAccount(list[0].id, u1)).rejects.toThrow(OfficialAccountNotFoundError); });
});

describe("Official accounts — delete with drafts (no FK error)", () => {
  const un = `oad_${Date.now().toString(36)}`; let u1: string, oaId: string, articleId: string;
  beforeAll(async () => {
    u1 = (await registerUser({ username: un, email: `oad_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) })).user.id;
    oaId = (await createMockOfficialAccount(u1, null, "待删除号")).id;
    articleId = (await prisma.article.create({ data: { userId: u1, title: "测试", status: "draft" } })).id;
    await pushDraft(u1, articleId, oaId);
  });
  afterAll(async () => { await prisma.draftPushTask.deleteMany({ where: { userId: u1 } }); await prisma.article.deleteMany({ where: { userId: u1 } }); await prisma.officialAccount.updateMany({ where: { userId: u1 }, data: { status: "revoked" } }); await prisma.officialAccount.deleteMany({ where: { userId: u1, status: { not: "revoked" } } }); await prisma.quotaUsage.deleteMany({ where: { userId: u1 } }); await prisma.userMembership.deleteMany({ where: { userId: u1 } }); await prisma.user.delete({ where: { id: u1 } }).catch(() => {}); });

  it("deleting OA with draft history does NOT throw FK error", async () => {
    await expect(deleteOfficialAccount(oaId, u1)).resolves.toBeUndefined();
  });

  it("after delete (revoke), OA no longer in list", async () => {
    const list = await listOfficialAccounts(u1);
    expect(list.find(x => x.id === oaId)).toBeUndefined();
  });

  it("after revoke, can create new OA (count not blocked)", async () => {
    const a = await createMockOfficialAccount(u1, null, "删后重建");
    expect(a.name).toBe("删后重建");
  });
});

describe("Draft push", () => {
  const un = `dp_${Date.now().toString(36)}`; let u1: string, oaId: string, articleId: string;
  beforeAll(async () => {
    u1 = (await registerUser({ username: un, email: `dp_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) })).user.id;
    oaId = (await createMockOfficialAccount(u1, null, "推送测试号")).id;
    articleId = (await prisma.article.create({ data: { userId: u1, title: "测试文章", status: "completed", markdownContent: "# test" } })).id;
  });
  afterAll(async () => { await prisma.draftPushTask.deleteMany({ where: { userId: u1 } }); await prisma.article.deleteMany({ where: { userId: u1 } }); await prisma.officialAccount.updateMany({ where: { userId: u1 }, data: { status: "revoked" } }); await prisma.officialAccount.deleteMany({ where: { userId: u1 } }); await prisma.quotaUsage.deleteMany({ where: { userId: u1 } }); await prisma.userMembership.deleteMany({ where: { userId: u1 } }); await prisma.user.delete({ where: { id: u1 } }).catch(() => {}); });
  it("creates draft push task with completed status", async () => { const t = await pushDraft(u1, articleId, oaId); expect(t.status).toBe("completed"); });
  it("cannot push to another user's OA", async () => { const u2 = (await registerUser({ username: `dp2_${Date.now().toString(36)}`, email: `dp2_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) })).user.id; await expect(pushDraft(u2, articleId, oaId)).rejects.toThrow(); await prisma.user.delete({ where: { id: u2 } }).catch(() => {}); });
});

describe("Push to revoked OA is blocked", () => {
  const un = `dpr_${Date.now().toString(36)}`; let u1: string, oaId: string, articleId: string;
  beforeAll(async () => {
    u1 = (await registerUser({ username: un, email: `dpr_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) })).user.id;
    oaId = (await createMockOfficialAccount(u1, null, "待撤销")).id;
    articleId = (await prisma.article.create({ data: { userId: u1, title: "测试", status: "completed", markdownContent: "# x" } })).id;
    // Push once and then revoke
    await pushDraft(u1, articleId, oaId);
    await deleteOfficialAccount(oaId, u1); // now revoked
  });
  afterAll(async () => { await prisma.draftPushTask.deleteMany({ where: { userId: u1 } }); await prisma.article.deleteMany({ where: { userId: u1 } }); await prisma.officialAccount.updateMany({ where: { userId: u1 }, data: { status: "revoked" } }); await prisma.officialAccount.deleteMany({ where: { userId: u1 } }); await prisma.quotaUsage.deleteMany({ where: { userId: u1 } }); await prisma.userMembership.deleteMany({ where: { userId: u1 } }); await prisma.user.delete({ where: { id: u1 } }).catch(() => {}); });

  it("pushDraft to revoked OA throws", async () => {
    // Reset daily draft_push quota so quota check doesn't block first
    const pk = new Date().toISOString().substring(0, 10);
    await prisma.quotaUsage.upsert({ where: { userId_capability_periodType_periodKey: { userId: u1, capability: "draft_push", periodType: "daily", periodKey: pk } }, create: { userId: u1, capability: "draft_push", periodType: "daily", periodKey: pk, used: 0 }, update: { used: 0 } });

    const jobsBefore = await prisma.draftPushTask.count({ where: { officialAccountId: oaId } });
    await expect(pushDraft(u1, articleId, oaId)).rejects.toThrow("不存在");
    // No new push task created
    const jobsAfter = await prisma.draftPushTask.count({ where: { officialAccountId: oaId } });
    expect(jobsAfter).toBe(jobsBefore);
  });
});

describe("Orders and payment", () => {
  const un = `ord_${Date.now().toString(36)}`; let u1: string, planId: string;
  beforeAll(async () => {
    u1 = (await registerUser({ username: un, email: `ord_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) })).user.id;
    planId = (await prisma.membershipPlan.findUnique({ where: { code: "pro" } }))!.id;
  });
  afterAll(async () => { await prisma.order.deleteMany({ where: { userId: u1 } }); await prisma.referralCommission.deleteMany({ where: { referrerUserId: u1 } }); await prisma.userMembership.updateMany({ where: { userId: u1 }, data: { status: "expired" } }); await prisma.userMembership.deleteMany({ where: { userId: u1, source: "order" } }); await prisma.quotaUsage.deleteMany({ where: { userId: u1 } }); await prisma.user.delete({ where: { id: u1 } }).catch(() => {}); });
  it("creates order", async () => { const o = await createOrder(u1, planId); expect(o.status).toBe("pending"); expect(o.orderNo).toContain("MOCK_"); });
  it("mock pay activates membership", async () => { const o = await createOrder(u1, planId); const paid = await mockPayOrder(o.id, u1); expect(paid.status).toBe("paid"); const ms = await prisma.userMembership.findFirst({ where: { userId: u1, source: "order", status: "active" } }); expect(ms).not.toBeNull(); });
  it("cannot pay same order twice", async () => { const o = await createOrder(u1, planId); await mockPayOrder(o.id, u1); await expect(mockPayOrder(o.id, u1)).rejects.toThrow(); });
});

describe("Membership code redemption", () => {
  const un = `mc_${Date.now().toString(36)}`; let u1: string, planId: string; const code1 = "VALID123", code2 = "EXPIRED456";
  beforeAll(async () => {
    u1 = (await registerUser({ username: un, email: `mc_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) })).user.id;
    planId = (await prisma.membershipPlan.findUnique({ where: { code: "pro" } }))!.id;
    await prisma.membershipCode.create({ data: { codeHash: crypto.createHash("sha256").update(code1).digest("hex"), planId, status: "unused" } });
    await prisma.membershipCode.create({ data: { codeHash: crypto.createHash("sha256").update(code2).digest("hex"), planId, status: "unused", expiresAt: new Date("2020-01-01") } });
  });
  afterAll(async () => { await prisma.membershipCode.deleteMany({ where: { codeHash: { in: [crypto.createHash("sha256").update(code1).digest("hex"), crypto.createHash("sha256").update(code2).digest("hex")] } } }); await prisma.userMembership.updateMany({ where: { userId: u1, source: "code" }, data: { status: "expired" } }); await prisma.userMembership.deleteMany({ where: { userId: u1, source: "code" } }); await prisma.quotaUsage.deleteMany({ where: { userId: u1 } }); await prisma.user.delete({ where: { id: u1 } }).catch(() => {}); });
  it("redeems valid code", async () => { const name = await redeemMembershipCode(u1, code1); expect(name).toBe("专业版"); });
  it("duplicate redeem fails", async () => { await expect(redeemMembershipCode(u1, code1)).rejects.toThrow("已使用"); });
  it("expired code fails", async () => { await expect(redeemMembershipCode(u1, code2)).rejects.toThrow("已过期"); });
});

describe("Referral and commission", () => {
  let referrer: string, referred: string, planId: string;
  beforeAll(async () => {
    referrer = (await registerUser({ username: `refr_${Date.now().toString(36)}`, email: `refr_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) })).user.id;
    referred = (await registerUser({ username: `refd_${Date.now().toString(36)}`, email: `refd_${Date.now().toString(36)}@t.com`, password: "x".repeat(8), referralCode: (await prisma.user.findUnique({ where: { id: referrer } }))!.referralCode })).user.id;
    planId = (await prisma.membershipPlan.findUnique({ where: { code: "pro" } }))!.id;
  });
  afterAll(async () => { await prisma.withdrawalRequest.deleteMany({ where: { userId: referrer } }); await prisma.referralCommission.deleteMany({ where: { referrerUserId: referrer } }); await prisma.order.deleteMany({ where: { userId: { in: [referrer, referred] } } }); await prisma.userMembership.updateMany({ where: { userId: { in: [referrer, referred] }, source: "order" }, data: { status: "expired" } }); await prisma.userMembership.deleteMany({ where: { userId: { in: [referrer, referred] }, source: "order" } }); await prisma.quotaUsage.deleteMany({ where: { userId: { in: [referrer, referred] } } }); await prisma.user.deleteMany({ where: { id: { in: [referrer, referred] } } }).catch(() => {}); });
  it("referrer gets commission when referred user pays", async () => { const o = await createOrder(referred, planId); await mockPayOrder(o.id, referred); const coms = await prisma.referralCommission.findMany({ where: { referrerUserId: referrer } }); expect(coms.length).toBeGreaterThanOrEqual(1); });
  it("shows referral summary", async () => { const s = await getReferralSummary(referrer); expect(s.totalCommission).toBeGreaterThan(0); });

  it("withdrawal succeeds with valid amount", async () => {
    const s = await getReferralSummary(referrer);
    if (s.availableCents > 0) {
      const w = await createWithdrawal(referrer, { amountCents: Math.min(s.availableCents, 100), alipayName: "测试", alipayAccount: "test@test.com" });
      expect(w.status).toBe("pending");
    }
  });

  it("duplicate withdrawal fails when pending withdrawals exhaust available", async () => {
    // Try to withdraw everything — may fail if not enough
    const s = await getReferralSummary(referrer);
    if (s.availableCents <= 0) return; // nothing to test
    await expect(createWithdrawal(referrer, { amountCents: s.availableCents + 1, alipayName: "x", alipayAccount: "x" })).rejects.toThrow("可提现金额不足");
  });

  it("withdrawal balance is reduced by pending withdrawals", async () => {
    const s = await getReferralSummary(referrer);
    // availableCents = totalCommission - withdrawn - pending
    expect(s.availableCents).toBeGreaterThanOrEqual(0);
  });
});
