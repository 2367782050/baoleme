import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { NextRequest } from "next/server";
import { prisma } from "../lib/db/prisma.js";
import { registerUser } from "../lib/services/auth.service.js";
import { signToken } from "../lib/auth/session.js";
import { createArticleGroup } from "../lib/services/article.service.js";
import { createGroup } from "../lib/services/prompt.service.js";

let cookieStore: Record<string, string> = {};
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: vi.fn((n: string) => { const v = cookieStore[n]; return v ? { name: n, value: v } : undefined; }), set: vi.fn((n: string, v: string) => { cookieStore[n] = v; }) })) }));
async function login(id: string, r = "user") { cookieStore["baoleme_session"] = await signToken({ userId: id, role: r }); }
function clear() { cookieStore = {}; }
function rid(id: string) { return { params: Promise.resolve({ id }) }; }
async function resetQuota(uid: string) { const pk = new Date().toISOString().substring(0, 10); await prisma.quotaUsage.upsert({ where: { userId_capability_periodType_periodKey: { userId: uid, capability: "article_generate", periodType: "daily", periodKey: pk } }, create: { userId: uid, capability: "article_generate", periodType: "daily", periodKey: pk, used: 0 }, update: { used: 0 } }); }

describe("Article groups API", () => {
  const un = `agapi_${Date.now().toString(36)}`, un2 = `agapi2_${Date.now().toString(36)}`;
  let u1: string, u2: string;
  beforeAll(async () => {
    u1 = (await registerUser({ username: un, email: `agapi_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) })).user.id;
    u2 = (await registerUser({ username: un2, email: `agapi2_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) })).user.id;
  });
  afterAll(async () => { await prisma.article.deleteMany({ where: { userId: { in: [u1, u2] } } }); await prisma.articleGroup.deleteMany({ where: { userId: { in: [u1, u2] } } }); await prisma.quotaUsage.deleteMany({ where: { userId: { in: [u1, u2] } } }); await prisma.userMembership.deleteMany({ where: { userId: { in: [u1, u2] } } }); await prisma.user.deleteMany({ where: { id: { in: [u1, u2] } } }); });

  it("POST /api/article/groups 401", async () => { clear(); const { POST } = await import("../app/api/article/groups/route.js"); expect((await POST({ json: async () => ({ name: "x" }) } as NextRequest)).status).toBe(401); });
  it("POST /api/article/groups creates group", async () => { await login(u1); const { POST } = await import("../app/api/article/groups/route.js"); const r = await POST({ json: async () => ({ name: "API分组" }) } as NextRequest); expect(r.status).toBe(200); expect((await r.json()).data.name).toBe("API分组"); });
  it("PUT /api/article/groups updates own", async () => { await login(u1); const { POST, PUT } = await import("../app/api/article/groups/route.js"); const g = await (await POST({ json: async () => ({ name: "待更新" }) } as NextRequest)).json();
    const r = await PUT({ json: async () => ({ id: g.data.id, name: "已更新" }) } as NextRequest); expect(r.status).toBe(200); });
  it("PUT /api/article/groups 404 for other's", async () => { await login(u2); const { POST } = await import("../app/api/article/groups/route.js"); const g = await (await POST({ json: async () => ({ name: "u2的分组" }) } as NextRequest)).json();
    await login(u1); const { PUT } = await import("../app/api/article/groups/route.js"); expect((await PUT({ json: async () => ({ id: g.data.id, name: "x" }) } as NextRequest)).status).toBe(404); });
  it("DELETE /api/article/groups removes empty group", async () => { await login(u1); const { POST, DELETE } = await import("../app/api/article/groups/route.js"); const g = await (await POST({ json: async () => ({ name: "待删除" }) } as NextRequest)).json();
    expect((await DELETE({ nextUrl: new URL(`http://x/api/article/groups?id=${g.data.id}`) } as unknown as NextRequest)).status).toBe(200); });
  it("DELETE /api/article/groups 409 for non-empty", async () => { await login(u1); const { POST, DELETE } = await import("../app/api/article/groups/route.js"); const g = await (await POST({ json: async () => ({ name: "有内容的组" }) } as NextRequest)).json();
    await prisma.article.create({ data: { userId: u1, groupId: g.data.id, status: "draft" } });
    expect((await DELETE({ nextUrl: new URL(`http://x/api/article/groups?id=${g.data.id}`) } as unknown as NextRequest)).status).toBe(409); });
});

describe("Article generate auth tests", () => {
  const un = `agen2_${Date.now().toString(36)}`;
  let u1: string, u2: string, otherPromptId: string, otherGroupId: string;
  beforeAll(async () => {
    u1 = (await registerUser({ username: un, email: `agen2_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) })).user.id;
    u2 = (await registerUser({ username: `agen2o_${Date.now().toString(36)}`, email: `agen2o_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) })).user.id;
    const og = await createGroup(u2, "u2的分组");
    const op = await prisma.prompt.create({ data: { userId: u2, name: "u2的提示词", content: "x", groupId: og.id, sourceType: "manual" } });
    otherPromptId = op.id;
    otherGroupId = (await createArticleGroup(u2, "u2文章组")).id;
  });
  afterAll(async () => { await prisma.articleGenerationJob.deleteMany({ where: { userId: { in: [u1, u2] } } }); await prisma.article.deleteMany({ where: { userId: { in: [u1, u2] } } }); await prisma.articleGroup.deleteMany({ where: { userId: { in: [u1, u2] } } }); await prisma.prompt.deleteMany({ where: { userId: { in: [u1, u2] } } }); await prisma.promptGroup.deleteMany({ where: { userId: { in: [u1, u2] } } }); await prisma.quotaUsage.deleteMany({ where: { userId: { in: [u1, u2] } } }); await prisma.userMembership.deleteMany({ where: { userId: { in: [u1, u2] } } }); await prisma.user.deleteMany({ where: { id: { in: [u1, u2] } } }).catch(() => {}); });

  it("generate with other's promptId returns 404 and creates nothing", async () => {
    await resetQuota(u1); await login(u1);
    const artsBefore = await prisma.article.count({ where: { userId: u1 } });
    const jobsBefore = await prisma.articleGenerationJob.count({ where: { userId: u1 } });
    const { POST } = await import("../app/api/articles/generate/route.js");
    const r = await POST({ json: async () => ({ title: "x", promptId: otherPromptId }) } as NextRequest);
    expect(r.status).toBe(404);
    expect(await prisma.article.count({ where: { userId: u1 } })).toBe(artsBefore);
    expect(await prisma.articleGenerationJob.count({ where: { userId: u1 } })).toBe(jobsBefore);
  });

  it("generate with other's groupId returns 404 and creates nothing", async () => {
    await resetQuota(u1); await login(u1);
    const artsBefore = await prisma.article.count({ where: { userId: u1 } });
    const jobsBefore = await prisma.articleGenerationJob.count({ where: { userId: u1 } });
    const { POST } = await import("../app/api/articles/generate/route.js");
    const r = await POST({ json: async () => ({ title: "x", groupId: otherGroupId }) } as NextRequest);
    expect(r.status).toBe(404);
    expect(await prisma.article.count({ where: { userId: u1 } })).toBe(artsBefore);
    expect(await prisma.articleGenerationJob.count({ where: { userId: u1 } })).toBe(jobsBefore);
  });

  it("generate quota exceeded returns QUOTA_EXCEEDED", async () => {
    await login(u1);
    const pk = new Date().toISOString().substring(0, 10);
    await prisma.quotaUsage.upsert({ where: { userId_capability_periodType_periodKey: { userId: u1, capability: "article_generate", periodType: "daily", periodKey: pk } }, create: { userId: u1, capability: "article_generate", periodType: "daily", periodKey: pk, used: 1 }, update: { used: 1 } });
    const artsBefore = await prisma.article.count({ where: { userId: u1 } });
    const jobsBefore = await prisma.articleGenerationJob.count({ where: { userId: u1 } });
    const { POST } = await import("../app/api/articles/generate/route.js");
    const r = await POST({ json: async () => ({ title: "超限" }) } as NextRequest);
    expect(r.status).toBe(403);
    const b = await r.json();
    expect(b.error.code).toBe("QUOTA_EXCEEDED");
    expect(await prisma.article.count({ where: { userId: u1 } })).toBe(artsBefore);
    expect(await prisma.articleGenerationJob.count({ where: { userId: u1 } })).toBe(jobsBefore);
  });
});

describe("Article retry API", () => {
  const un = `aretry_${Date.now().toString(36)}`;
  let u1: string, u2: string;
  beforeAll(async () => {
    u1 = (await registerUser({ username: un, email: `aretry_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) })).user.id;
    u2 = (await registerUser({ username: `aretry2_${Date.now().toString(36)}`, email: `aretry2_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) })).user.id;
  });
  afterAll(async () => { await prisma.articleGenerationJob.deleteMany({ where: { userId: { in: [u1, u2] } } }); await prisma.article.deleteMany({ where: { userId: { in: [u1, u2] } } }); await prisma.articleGroup.deleteMany({ where: { userId: { in: [u1, u2] } } }); await prisma.quotaUsage.deleteMany({ where: { userId: { in: [u1, u2] } } }); await prisma.userMembership.deleteMany({ where: { userId: { in: [u1, u2] } } }); await prisma.user.deleteMany({ where: { id: { in: [u1, u2] } } }).catch(() => {}); });

  it("POST /api/articles/jobs/[id]/retry 401", async () => { clear(); const { POST } = await import("../app/api/articles/jobs/[id]/retry/route.js"); expect((await POST({} as NextRequest, rid("any"))).status).toBe(401); });

  it("POST /api/articles/jobs/[id]/retry 404 for other user's job", async () => {
    await resetQuota(u1); await login(u1);
    const { POST: gen } = await import("../app/api/articles/generate/route.js");
    const r = await gen({ json: async () => ({ title: "retry test" }) } as NextRequest);
    const jid = (await r.json()).data.jobId;
    await login(u2);
    const { POST } = await import("../app/api/articles/jobs/[id]/retry/route.js");
    expect((await POST({} as NextRequest, rid(jid))).status).toBe(404);
  });

  it("POST /api/articles/jobs/[id]/retry 409 for non-failed job", async () => {
    await resetQuota(u1); await login(u1);
    const { POST: gen } = await import("../app/api/articles/generate/route.js");
    const r = await gen({ json: async () => ({ title: "pending job" }) } as NextRequest);
    const jid = (await r.json()).data.jobId;
    const { POST } = await import("../app/api/articles/jobs/[id]/retry/route.js");
    const res = await POST({} as NextRequest, rid(jid));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
  });
});
