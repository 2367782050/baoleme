import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { NextRequest } from "next/server";
import { prisma } from "../lib/db/prisma.js";
import { registerUser } from "../lib/services/auth.service.js";
import { signToken } from "../lib/auth/session.js";
import crypto from "node:crypto";

let cookieStore: Record<string, string> = {};
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: vi.fn((n: string) => { const v = cookieStore[n]; return v ? { name: n, value: v } : undefined; }), set: vi.fn((n: string, v: string) => { cookieStore[n] = v; }) })) }));
async function login(id: string, r = "user") { cookieStore["baoleme_session"] = await signToken({ userId: id, role: r }); }
function clear() { cookieStore = {}; }
function rid(id: string) { return { params: Promise.resolve({ id }) }; }

describe("API: /api/official-accounts", () => {
  const un = `oaa_${Date.now().toString(36)}`; let u1: string;
  beforeAll(async () => { u1 = (await registerUser({ username: un, email: `oaa_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) })).user.id; });
  afterAll(async () => { await prisma.draftPushTask.deleteMany({ where: { userId: u1 } }); await prisma.officialAccount.deleteMany({ where: { userId: u1 } }); await prisma.quotaUsage.deleteMany({ where: { userId: u1 } }); await prisma.userMembership.deleteMany({ where: { userId: u1 } }); await prisma.user.delete({ where: { id: u1 } }).catch(() => {}); });

  it("GET 401 when not logged in", async () => { clear(); const { GET } = await import("../app/api/official-accounts/route.js"); expect((await GET({ nextUrl: new URL("http://x/api/official-accounts") } as unknown as NextRequest)).status).toBe(401); });
  it("POST creates mock OA", async () => { await login(u1); const { POST } = await import("../app/api/official-accounts/route.js"); const r = await POST({ json: async () => ({ name: "API测试号" }) } as NextRequest); expect(r.status).toBe(200); });
  it("POST 2nd OA fails (quota)", async () => { await login(u1); const { POST } = await import("../app/api/official-accounts/route.js"); const r = await POST({ json: async () => ({ name: "第二个" }) } as NextRequest); expect(r.status).toBe(403); });
  it("can recreate after delete", async () => { await login(u1); const { GET, DELETE } = await import("../app/api/official-accounts/route.js"); const list = await (await GET({ nextUrl: new URL("http://x/api/official-accounts") } as unknown as NextRequest)).json();
    const id = list.data[0]?.id; if (!id) return; await DELETE({ nextUrl: new URL(`http://x/api/official-accounts?id=${id}`) } as unknown as NextRequest);
    const { POST } = await import("../app/api/official-accounts/route.js"); const r = await POST({ json: async () => ({ name: "重建成功" }) } as NextRequest); expect(r.status).toBe(200); });
});

describe("API: /api/official-accounts/mock (draft push)", () => {
  const un = `oada_${Date.now().toString(36)}`; let u1: string, u2: string, oaId: string;
  beforeAll(async () => { u1 = (await registerUser({ username: un, email: `oada_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) })).user.id; u2 = (await registerUser({ username: `oada2_${Date.now().toString(36)}`, email: `oada2_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) })).user.id; oaId = (await prisma.officialAccount.create({ data: { userId: u1, name: "推送号", appid: "mock_x", status: "mock_authorized" } })).id; });
  afterAll(async () => { await prisma.draftPushTask.deleteMany({ where: { userId: { in: [u1, u2] } } }); await prisma.officialAccount.updateMany({ where: { id: oaId }, data: { status: "revoked" } }); await prisma.officialAccount.deleteMany({ where: { userId: { in: [u1, u2] } } }); await prisma.quotaUsage.deleteMany({ where: { userId: { in: [u1, u2] } } }); await prisma.userMembership.deleteMany({ where: { userId: { in: [u1, u2] } } }); await prisma.user.deleteMany({ where: { id: { in: [u1, u2] } } }).catch(() => {}); });

  it("push to other's OA returns 400 not 500", async () => { await login(u2); const { POST } = await import("../app/api/official-accounts/mock/route.js"); const r = await POST({ json: async () => ({ articleId: "00000000-0000-0000-0000-000000000000", officialAccountId: oaId }) } as NextRequest); expect(r.status).toBe(400); });

  it("push to revoked OA returns 400 not 500", async () => {
    // Create article
    const aid = (await prisma.article.create({ data: { userId: u1, title: "revoked test", status: "completed", markdownContent: "# x" } })).id;
    // Revoke the OA
    await prisma.officialAccount.update({ where: { id: oaId }, data: { status: "revoked" } });
    // Reset draft_push quota
    const pk = new Date().toISOString().substring(0, 10);
    await prisma.quotaUsage.upsert({ where: { userId_capability_periodType_periodKey: { userId: u1, capability: "draft_push", periodType: "daily", periodKey: pk } }, create: { userId: u1, capability: "draft_push", periodType: "daily", periodKey: pk, used: 0 }, update: { used: 0 } });

    await login(u1); const { POST } = await import("../app/api/official-accounts/mock/route.js");
    const r = await POST({ json: async () => ({ articleId: aid, officialAccountId: oaId }) } as NextRequest);
    expect(r.status).toBe(400);
    // Revert revoked so other tests aren't blocked
    await prisma.officialAccount.update({ where: { id: oaId }, data: { status: "mock_authorized" } });
  });
});

describe("API: /api/orders and mock-pay", () => {
  const un = `orda_${Date.now().toString(36)}`; let u1: string, planId: string;
  beforeAll(async () => { u1 = (await registerUser({ username: un, email: `orda_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) })).user.id; planId = (await prisma.membershipPlan.findUnique({ where: { code: "pro" } }))!.id; });
  afterAll(async () => { await prisma.order.deleteMany({ where: { userId: u1 } }); await prisma.referralCommission.deleteMany({ where: { referrerUserId: u1 } }); await prisma.userMembership.updateMany({ where: { userId: u1 }, data: { status: "expired" } }); await prisma.userMembership.deleteMany({ where: { userId: u1, source: "order" } }); await prisma.quotaUsage.deleteMany({ where: { userId: u1 } }); await prisma.user.delete({ where: { id: u1 } }).catch(() => {}); });

  it("invalid planId returns 400 not 500", async () => { await login(u1); const { POST } = await import("../app/api/orders/route.js"); const r = await POST({ json: async () => ({ planId: "bad-id" }) } as NextRequest); expect(r.status).toBe(400); });
  it("creates order OK", async () => { await login(u1); const { POST } = await import("../app/api/orders/route.js"); const r = await POST({ json: async () => ({ planId }) } as NextRequest); expect(r.status).toBe(200); });
  it("duplicate pay returns 400 not 500", async () => {
    await login(u1); const { POST } = await import("../app/api/orders/route.js");
    const o = await (await POST({ json: async () => ({ planId }) } as NextRequest)).json();
    const { POST: PAY } = await import("../app/api/orders/[id]/mock-pay/route.js");
    await PAY({} as NextRequest, rid(o.data.id)); // first pay
    const r = await PAY({} as NextRequest, rid(o.data.id)); // second pay
    expect(r.status).toBe(400);
  });
});

describe("API: /api/membership/redeem-code", () => {
  const un = `rca_${Date.now().toString(36)}`; let u1: string;
  beforeAll(async () => {
    u1 = (await registerUser({ username: un, email: `rca_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) })).user.id;
    const planId = (await prisma.membershipPlan.findUnique({ where: { code: "pro" } }))!.id;
    await prisma.membershipCode.create({ data: { codeHash: crypto.createHash("sha256").update("APICODE").digest("hex"), planId, status: "unused" } });
  });
  afterAll(async () => { await prisma.membershipCode.deleteMany({ where: { codeHash: crypto.createHash("sha256").update("APICODE").digest("hex") } }); await prisma.userMembership.updateMany({ where: { userId: u1, source: "code" }, data: { status: "expired" } }); await prisma.userMembership.deleteMany({ where: { userId: u1, source: "code" } }); await prisma.quotaUsage.deleteMany({ where: { userId: u1 } }); await prisma.user.delete({ where: { id: u1 } }).catch(() => {}); });

  it("invalid code returns 400 not 500", async () => { await login(u1); const { POST } = await import("../app/api/membership/redeem-code/route.js"); const r = await POST({ json: async () => ({ code: "INVALID" }) } as NextRequest); expect(r.status).toBe(400); });
  it("valid code returns 200", async () => { await login(u1); const { POST } = await import("../app/api/membership/redeem-code/route.js"); const r = await POST({ json: async () => ({ code: "APICODE" }) } as NextRequest); expect(r.status).toBe(200); });
});

describe("API: /api/referral/withdrawals", () => {
  const un = `rwa_${Date.now().toString(36)}`; let u1: string;
  beforeAll(async () => { u1 = (await registerUser({ username: un, email: `rwa_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) })).user.id; });
  afterAll(async () => { await prisma.withdrawalRequest.deleteMany({ where: { userId: u1 } }); await prisma.referralCommission.deleteMany({ where: { referrerUserId: u1 } }); await prisma.order.deleteMany({ where: { userId: u1 } }); await prisma.quotaUsage.deleteMany({ where: { userId: u1 } }); await prisma.userMembership.deleteMany({ where: { userId: u1 } }); await prisma.user.delete({ where: { id: u1 } }).catch(() => {}); });

  it("withdraw with no balance returns 400 not 500", async () => {
    await login(u1); const { POST } = await import("../app/api/referral/withdrawals/route.js");
    const r = await POST({ json: async () => ({ amountCents: 99999, alipayName: "x", alipayAccount: "x" }) } as NextRequest);
    expect(r.status).toBe(400);
    const b = await r.json();
    expect(b.error.message).toContain("可提现金额不足");
  });
});
