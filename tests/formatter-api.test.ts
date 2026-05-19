import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { NextRequest } from "next/server";
import { prisma } from "../lib/db/prisma.js";
import { registerUser } from "../lib/services/auth.service.js";
import { signToken } from "../lib/auth/session.js";

let cookieStore: Record<string, string> = {};
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: vi.fn((n: string) => { const v = cookieStore[n]; return v ? { name: n, value: v } : undefined; }), set: vi.fn((n: string, v: string) => { cookieStore[n] = v; }) })) }));
async function login(id: string, r = "user") { cookieStore["baoleme_session"] = await signToken({ userId: id, role: r }); }
function clear() { cookieStore = {}; }
function rid(id: string) { return { params: Promise.resolve({ id }) }; }

describe("POST /api/formatter/render", () => {
  const un = `fmt_${Date.now().toString(36)}`;
  let u1: string;
  beforeAll(async () => { u1 = (await registerUser({ username: un, email: `fmt_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) })).user.id; });
  afterAll(async () => { await prisma.quotaUsage.deleteMany({ where: { userId: u1 } }); await prisma.userMembership.deleteMany({ where: { userId: u1 } }); await prisma.user.delete({ where: { id: u1 } }).catch(() => {}); });

  it("returns 401 when not logged in", async () => { clear(); const { POST } = await import("../app/api/formatter/render/route.js"); expect((await POST({ json: async () => ({ markdown: "# x" }) } as NextRequest)).status).toBe(401); });

  it("returns html when logged in", async () => { await login(u1); const { POST } = await import("../app/api/formatter/render/route.js"); const r = await POST({ json: async () => ({ markdown: "# Hello" }) } as NextRequest); expect(r.status).toBe(200); const b = await r.json(); expect(b.data.html).toContain("<h1"); expect(b.data.html).toContain("Hello"); });

  it("returns VALIDATION_ERROR for missing markdown", async () => { await login(u1); const { POST } = await import("../app/api/formatter/render/route.js"); const r = await POST({ json: async () => ({}) } as NextRequest); expect(r.status).toBe(400); });

  it("returns VALIDATION_ERROR for out-of-range fontSize", async () => { await login(u1); const { POST } = await import("../app/api/formatter/render/route.js"); const r = await POST({ json: async () => ({ markdown: "x", fontSize: 99 }) } as NextRequest); expect(r.status).toBe(400); });

  it("returns 400 for fontSize: 'abc' (non-number)", async () => { await login(u1); const { POST } = await import("../app/api/formatter/render/route.js"); const r = await POST({ json: async () => ({ markdown: "x", fontSize: "abc" }) } as NextRequest); expect(r.status).toBe(400); });

  it("returns 400 for lineHeight: 'bad' (non-number)", async () => { await login(u1); const { POST } = await import("../app/api/formatter/render/route.js"); const r = await POST({ json: async () => ({ markdown: "x", lineHeight: "bad" }) } as NextRequest); expect(r.status).toBe(400); });

  it("returns 400 for fontSize: NaN", async () => { await login(u1); const { POST } = await import("../app/api/formatter/render/route.js"); const r = await POST({ json: async () => ({ markdown: "x", fontSize: NaN }) } as NextRequest); expect(r.status).toBe(400); });

  it("returns 400 for imageRounded: Infinity", async () => { await login(u1); const { POST } = await import("../app/api/formatter/render/route.js"); const r = await POST({ json: async () => ({ markdown: "x", imageRounded: Infinity }) } as NextRequest); expect(r.status).toBe(400); });
});

describe("Article formatterConfig save", () => {
  const un = `fmtc_${Date.now().toString(36)}`, un2 = `fmtc2_${Date.now().toString(36)}`;
  let u1: string, u2: string, a1: string;
  beforeAll(async () => {
    u1 = (await registerUser({ username: un, email: `fmtc_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) })).user.id;
    u2 = (await registerUser({ username: un2, email: `fmtc2_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) })).user.id;
    a1 = (await prisma.article.create({ data: { userId: u1, title: "排版测试", status: "draft" } })).id;
  });
  afterAll(async () => { await prisma.article.deleteMany({ where: { userId: { in: [u1, u2] } } }); await prisma.quotaUsage.deleteMany({ where: { userId: { in: [u1, u2] } } }); await prisma.userMembership.deleteMany({ where: { userId: { in: [u1, u2] } } }); await prisma.user.deleteMany({ where: { id: { in: [u1, u2] } } }); });

  it("saves formatterConfig and htmlContent on own article", async () => {
    await login(u1);
    const { PUT } = await import("../app/api/articles/[id]/route.js");
    const r = await PUT({ json: async () => ({ formatterConfig: { themeColor: "#ff0000" }, htmlContent: "<p>html</p>" }) } as NextRequest, rid(a1));
    expect(r.status).toBe(200);
    const a = await prisma.article.findUnique({ where: { id: a1 } });
    const fc = a!.formatterConfig as Record<string, string> | null;
    expect(fc?.themeColor).toBe("#ff0000");
    expect(a!.htmlContent).toBe("<p>html</p>");
  });

  it("re-reads article with formatterConfig", async () => {
    await login(u1);
    const { GET } = await import("../app/api/articles/[id]/route.js");
    const r = await GET({} as NextRequest, rid(a1));
    expect(r.status).toBe(200);
    const b = await r.json();
    const fc = b.data.formatterConfig as Record<string, string> | null;
    expect(fc?.themeColor).toBe("#ff0000");
  });

  it("cannot save another user's article", async () => {
    const a2 = (await prisma.article.create({ data: { userId: u2, title: "别人的", status: "draft" } })).id;
    await login(u1);
    const { PUT } = await import("../app/api/articles/[id]/route.js");
    const r = await PUT({ json: async () => ({ formatterConfig: {} }) } as NextRequest, rid(a2));
    expect(r.status).toBe(404);
  });
});
