import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { NextRequest } from "next/server";
import { prisma } from "../lib/db/prisma.js";
import { registerUser } from "../lib/services/auth.service.js";
import { signToken } from "../lib/auth/session.js";

const cookieStore: Record<string, string> = {};
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: vi.fn((n: string) => { const v = cookieStore[n]; return v ? { name: n, value: v } : undefined; }), set: vi.fn((n: string, v: string) => { cookieStore[n] = v; }) })) }));
async function setSession(id: string, r = "user") { cookieStore["baoleme_session"] = await signToken({ userId: id, role: r }); }
function rid(id: string) { return { params: Promise.resolve({ id }) }; }

describe("Admin: disabled user cannot access", () => {
  let userId: string;
  beforeAll(async () => {
    userId = (await registerUser({ username: `dac_${Date.now().toString(36)}`, email: `dac_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) })).user.id;
    await setSession(userId);
    cookieStore["baoleme_session"] = await signToken({ userId, role: "user" });
  });
  afterAll(async () => {
    await prisma.quotaUsage.deleteMany({ where: { userId } });
    await prisma.userMembership.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it("user can access /api/auth/me while active", async () => {
    await setSession(userId);
    const { GET } = await import("../app/api/auth/me/route.js");
    const r = await GET();
    expect(r.status).toBe(200);
  });

  it("after admin disables user, /api/auth/me returns 401", async () => {
    // Disable directly via prisma
    await prisma.user.update({ where: { id: userId }, data: { status: "disabled" } });
    await setSession(userId); // session still has old role in JWT but requireAuth checks DB
    const { GET } = await import("../app/api/auth/me/route.js");
    const r = await GET();
    expect(r.status).toBe(401);
    expect((await r.json()).error.code).toBe("UNAUTHORIZED");
  });

  it("disabled user cannot access /api/prompts", async () => {
    const { GET } = await import("../app/api/prompts/route.js");
    const r = await GET({ nextUrl: new URL("http://x/api/prompts") } as unknown as NextRequest);
    expect(r.status).toBe(401);
  });
});

describe("Admin: disabled admin cannot access admin API", () => {
  let adminId: string;
  beforeAll(async () => {
    adminId = (await registerUser({ username: `dadm_${Date.now().toString(36)}`, email: `dadm_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) })).user.id;
    await prisma.user.update({ where: { id: adminId }, data: { role: "admin" } });
    await setSession(adminId, "admin");
  });
  afterAll(async () => {
    await prisma.quotaUsage.deleteMany({ where: { userId: adminId } });
    await prisma.userMembership.deleteMany({ where: { userId: adminId } });
    await prisma.user.delete({ where: { id: adminId } }).catch(() => {});
  });

  it("admin can access /api/admin/users while active", async () => {
    const { GET } = await import("../app/api/admin/users/route.js");
    const r = await GET({ nextUrl: new URL("http://x/api/admin/users") } as unknown as NextRequest);
    expect(r.status).toBe(200);
  });

  it("after disable, admin gets 401 on /api/admin/users", async () => {
    await prisma.user.update({ where: { id: adminId }, data: { status: "disabled" } });
    // Re-set session — JWT still has role=admin but requireAuth will check DB status
    cookieStore["baoleme_session"] = await signToken({ userId: adminId, role: "admin" });
    const { GET } = await import("../app/api/admin/users/route.js");
    const r = await GET({ nextUrl: new URL("http://x/api/admin/users") } as unknown as NextRequest);
    expect(r.status).toBe(401);
  });
});

describe("Admin: regular user gets 403 on admin APIs", () => {
  let userId: string, adminId: string;
  beforeAll(async () => {
    userId = (await registerUser({ username: `uar_${Date.now().toString(36)}`, email: `uar_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) })).user.id;
    adminId = (await registerUser({ username: `uaa_${Date.now().toString(36)}`, email: `uaa_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) })).user.id;
    await prisma.user.update({ where: { id: adminId }, data: { role: "admin" } });
  });
  afterAll(async () => {
    await prisma.quotaUsage.deleteMany({ where: { userId: { in: [userId, adminId] } } });
    await prisma.userMembership.deleteMany({ where: { userId: { in: [userId, adminId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, adminId] } } }).catch(() => {});
  });

  it("regular user gets 403 on users list", async () => { await setSession(userId); const { GET } = await import("../app/api/admin/users/route.js"); expect((await GET({ nextUrl: new URL("http://x/api/admin/users") } as unknown as NextRequest)).status).toBe(403); });
  it("admin gets 200 on users list", async () => { await setSession(adminId, "admin"); const { GET } = await import("../app/api/admin/users/route.js"); expect((await GET({ nextUrl: new URL("http://x/api/admin/users") } as unknown as NextRequest)).status).toBe(200); });
  it("regular user gets 403 on orders", async () => { await setSession(userId); const { GET } = await import("../app/api/admin/orders/route.js"); expect((await GET({ nextUrl: new URL("http://x/api/admin/orders") } as unknown as NextRequest)).status).toBe(403); });
  it("regular user gets 403 on withdrawals", async () => { await setSession(userId); const { GET } = await import("../app/api/admin/withdrawals/route.js"); expect((await GET({ nextUrl: new URL("http://x/api/admin/withdrawals") } as unknown as NextRequest)).status).toBe(403); });
  it("regular user gets 403 on disable", async () => { await setSession(userId); const { POST } = await import("../app/api/admin/users/[id]/status/route.js"); const r = await POST({ json: async () => ({ status: "disabled" }) } as NextRequest, rid(adminId)); expect(r.status).toBe(403); });
  it("regular user gets 403 on grant membership", async () => { await setSession(userId); const { POST } = await import("../app/api/admin/membership/grant/route.js"); const planId = (await prisma.membershipPlan.findUnique({ where: { code: "free" } }))!.id; const r = await POST({ json: async () => ({ userId, planId }) } as NextRequest); expect(r.status).toBe(403); });
  it("regular user gets 403 on review withdrawal", async () => { await setSession(userId); const { POST } = await import("../app/api/admin/withdrawals/[id]/route.js"); const r = await POST({ json: async () => ({ action: "approved" }) } as NextRequest, rid("any")); expect(r.status).toBe(403); });
});
