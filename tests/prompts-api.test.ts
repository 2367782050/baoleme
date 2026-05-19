import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { NextRequest } from "next/server";
import { prisma } from "../lib/db/prisma.js";
import { registerUser } from "../lib/services/auth.service.js";
import { signToken } from "../lib/auth/session.js";
import {
  createGroup,
  createPrompt,
} from "../lib/services/prompt.service.js";

let cookieStore: Record<string, string> = {};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn((name: string) => {
      const value = cookieStore[name];
      return value ? { name, value } : undefined;
    }),
    set: vi.fn((name: string, value: string) => {
      cookieStore[name] = value;
    }),
  })),
}));

async function setSessionAsync(userId: string, role: string = "user") {
  cookieStore["baoleme_session"] = await signToken({ userId, role });
}
function clearSession() {
  cookieStore = {};
}

// Helper: creates a route context with { id } for [id] routes
function rid(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("Prompt groups API", () => {
  const username = `apig_${Date.now().toString(36)}`;
  const username2 = `apig2_${Date.now().toString(36)}`;
  let userId: string;
  let userId2: string;

  beforeAll(async () => {
    const u = await registerUser({
      username,
      email: `apig_${Date.now().toString(36)}@example.com`,
      password: "test1234",
    });
    userId = u.user.id;

    const u2 = await registerUser({
      username: username2,
      email: `apig2_${Date.now().toString(36)}@example.com`,
      password: "test1234",
    });
    userId2 = u2.user.id;
  });

  afterAll(async () => {
    await prisma.prompt.deleteMany({ where: { userId: { in: [userId, userId2] } } });
    await prisma.promptGroup.deleteMany({ where: { userId: { in: [userId, userId2] } } });
    await prisma.quotaUsage.deleteMany({ where: { userId: { in: [userId, userId2] } } });
    await prisma.userMembership.deleteMany({ where: { userId: { in: [userId, userId2] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, userId2] } } });
    clearSession();
  });

  it("POST returns 401 when not logged in", async () => {
    clearSession();
    const { POST } = await import("../app/api/prompts/groups/route.js");
    const req = { json: async () => ({ name: "test" }) } as NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("POST creates a group when logged in", async () => {
    await setSessionAsync(userId);
    const { POST } = await import("../app/api/prompts/groups/route.js");
    const req = { json: async () => ({ name: "API测试分组" }) } as NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.name).toBe("API测试分组");
  });

  it("GET returns only own groups", async () => {
    // Create a group for user2
    await setSessionAsync(userId2);
    const { POST } = await import("../app/api/prompts/groups/route.js");
    const req = { json: async () => ({ name: "user2的分组" }) } as NextRequest;
    await POST(req);

    // Now user1 gets their own
    await setSessionAsync(userId);
    const { GET } = await import("../app/api/prompts/groups/route.js");
    const res = await GET();
    const body = await res.json();
    expect(body.data.every((g: { userId: string }) => g.userId === userId)).toBe(true);
  });
});

describe("Prompt groups API — PUT and DELETE", () => {
  const username = `apigx_${Date.now().toString(36)}`;
  const username2 = `apigx2_${Date.now().toString(36)}`;
  let userId: string;
  let userId2: string;

  beforeAll(async () => {
    const u = await registerUser({
      username,
      email: `apigx_${Date.now().toString(36)}@example.com`,
      password: "test1234",
    });
    userId = u.user.id;

    const u2 = await registerUser({
      username: username2,
      email: `apigx2_${Date.now().toString(36)}@example.com`,
      password: "test1234",
    });
    userId2 = u2.user.id;
  });

  afterAll(async () => {
    await prisma.prompt.deleteMany({ where: { userId: { in: [userId, userId2] } } });
    await prisma.promptGroup.deleteMany({ where: { userId: { in: [userId, userId2] } } });
    await prisma.quotaUsage.deleteMany({ where: { userId: { in: [userId, userId2] } } });
    await prisma.userMembership.deleteMany({ where: { userId: { in: [userId, userId2] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, userId2] } } });
    clearSession();
  });

  it("PUT updates own group", async () => {
    await setSessionAsync(userId);
    const g = await createGroup(userId, "待改名");
    const { PUT } = await import("../app/api/prompts/groups/route.js");
    const req = { json: async () => ({ id: g.id, name: "新名称" }) } as NextRequest;
    const res = await PUT(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.name).toBe("新名称");
  });

  it("PUT returns 404 for another user's group", async () => {
    await setSessionAsync(userId2);
    const g = await createGroup(userId2, "user2的分组2");
    await setSessionAsync(userId);
    const { PUT } = await import("../app/api/prompts/groups/route.js");
    const req = { json: async () => ({ id: g.id, name: "不能改" }) } as NextRequest;
    const res = await PUT(req);
    expect(res.status).toBe(404);
  });

  it("DELETE removes empty group", async () => {
    await setSessionAsync(userId);
    const g = await createGroup(userId, "待删除组");
    const { DELETE } = await import("../app/api/prompts/groups/route.js");
    const req = { nextUrl: new URL(`http://localhost/api/prompts/groups?id=${g.id}`) } as unknown as NextRequest;
    const res = await DELETE(req);
    expect(res.status).toBe(200);
  });

  it("DELETE returns 409 for non-empty group", async () => {
    await setSessionAsync(userId);
    const g = await createGroup(userId, "有内容组");
    await createPrompt(userId, { name: "p", content: "c", groupId: g.id });
    const { DELETE } = await import("../app/api/prompts/groups/route.js");
    const req = { nextUrl: new URL(`http://localhost/api/prompts/groups?id=${g.id}`) } as unknown as NextRequest;
    const res = await DELETE(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("GROUP_NOT_EMPTY");
  });
});

describe("Prompts [id] API", () => {
  const username = `apipid_${Date.now().toString(36)}`;
  const username2 = `apipid2_${Date.now().toString(36)}`;
  let userId: string;
  let userId2: string;
  let promptId: string;
  let otherPromptId: string;

  beforeAll(async () => {
    const u = await registerUser({
      username,
      email: `apipid_${Date.now().toString(36)}@example.com`,
      password: "test1234",
    });
    userId = u.user.id;
    promptId = (await createPrompt(userId, { name: "我的提示词", content: "我的内容" })).id;

    const u2 = await registerUser({
      username: username2,
      email: `apipid2_${Date.now().toString(36)}@example.com`,
      password: "test1234",
    });
    userId2 = u2.user.id;
    otherPromptId = (await createPrompt(userId2, { name: "别人的", content: "x" })).id;
  });

  afterAll(async () => {
    await prisma.promptGenerationJob.deleteMany({ where: { userId: { in: [userId, userId2] } } });
    await prisma.prompt.deleteMany({ where: { userId: { in: [userId, userId2] } } });
    await prisma.promptGroup.deleteMany({ where: { userId: { in: [userId, userId2] } } });
    await prisma.quotaUsage.deleteMany({ where: { userId: { in: [userId, userId2] } } });
    await prisma.userMembership.deleteMany({ where: { userId: { in: [userId, userId2] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, userId2] } } });
    clearSession();
  });

  it("GET /api/prompts/[id] returns own prompt", async () => {
    await setSessionAsync(userId);
    const { GET } = await import("../app/api/prompts/[id]/route.js");
    const req = {} as NextRequest;
    const res = await GET(req, rid(promptId));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.name).toBe("我的提示词");
  });

  it("GET /api/prompts/[id] returns 404 for another user's prompt", async () => {
    await setSessionAsync(userId);
    const { GET } = await import("../app/api/prompts/[id]/route.js");
    const req = {} as NextRequest;
    const res = await GET(req, rid(otherPromptId));
    expect(res.status).toBe(404);
  });

  it("PUT /api/prompts/[id] updates own prompt", async () => {
    await setSessionAsync(userId);
    const { PUT } = await import("../app/api/prompts/[id]/route.js");
    const req = { json: async () => ({ name: "更新后的名称" }) } as NextRequest;
    const res = await PUT(req, rid(promptId));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.name).toBe("更新后的名称");
  });

  it("PUT /api/prompts/[id] returns 404 for another user's prompt", async () => {
    await setSessionAsync(userId);
    const { PUT } = await import("../app/api/prompts/[id]/route.js");
    const req = { json: async () => ({ name: "不能改" }) } as NextRequest;
    const res = await PUT(req, rid(otherPromptId));
    expect(res.status).toBe(404);
  });

  it("DELETE /api/prompts/[id] deletes own prompt", async () => {
    await setSessionAsync(userId);
    const p = await createPrompt(userId, { name: "待删除API", content: "x" });
    const { DELETE } = await import("../app/api/prompts/[id]/route.js");
    const req = {} as NextRequest;
    const res = await DELETE(req, rid(p.id));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it("DELETE /api/prompts/[id] returns 404 for another user's prompt", async () => {
    await setSessionAsync(userId);
    const { DELETE } = await import("../app/api/prompts/[id]/route.js");
    const req = {} as NextRequest;
    const res = await DELETE(req, rid(otherPromptId));
    expect(res.status).toBe(404);
  });
});

describe("Generation jobs API", () => {
  const username = `apijob_${Date.now().toString(36)}`;
  const username2 = `apijob2_${Date.now().toString(36)}`;
  let userId: string;
  let userId2: string;
  let jobId: string;
  let otherJobId: string;

  beforeAll(async () => {
    const u = await registerUser({
      username,
      email: `apijob_${Date.now().toString(36)}@example.com`,
      password: "test1234",
    });
    userId = u.user.id;

    const u2 = await registerUser({
      username: username2,
      email: `apijob2_${Date.now().toString(36)}@example.com`,
      password: "test1234",
    });
    userId2 = u2.user.id;

    // Create jobs for both users
    cookieStore["baoleme_session"] = await signToken({ userId, role: "user" });
    const { POST } = await import("../app/api/prompts/generate/route.js");
    const r1 = await POST({
      json: async () => ({
        name: "job1",
        contentDomain: "x",
        targetAudience: "x",
        authorName: "x",
        personaDetails: "x",
        personalityTraits: ["x"],
        headingStyle: "numbered",
        wordCount: 100,
        enableAIDetectionEvasion: false,
        materialAnalysisJson: "{}",
        userNotes: "",
      }),
    } as NextRequest);
    const b1 = await r1.json();
    jobId = b1.data.jobId;

    cookieStore["baoleme_session"] = await signToken({ userId: userId2, role: "user" });
    const r2 = await POST({
      json: async () => ({
        name: "job2",
        contentDomain: "x",
        targetAudience: "x",
        authorName: "x",
        personaDetails: "x",
        personalityTraits: ["x"],
        headingStyle: "numbered",
        wordCount: 100,
        enableAIDetectionEvasion: false,
        materialAnalysisJson: "{}",
        userNotes: "",
      }),
    } as NextRequest);
    const b2 = await r2.json();
    otherJobId = b2.data.jobId;
  });

  afterAll(async () => {
    // Wait for any async setImmediate prompt generation workers to complete
    await new Promise((r) => setTimeout(r, 500));
    await prisma.promptGenerationJob.deleteMany({ where: { userId: { in: [userId, userId2] } } });
    await prisma.prompt.deleteMany({ where: { userId: { in: [userId, userId2] } } });
    await prisma.promptGroup.deleteMany({ where: { userId: { in: [userId, userId2] } } });
    await prisma.quotaUsage.deleteMany({ where: { userId: { in: [userId, userId2] } } });
    await prisma.userMembership.deleteMany({ where: { userId: { in: [userId, userId2] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, userId2] } } });
    clearSession();
  });

  it("GET /api/prompts/generation-jobs/[id] returns own job", async () => {
    await setSessionAsync(userId);
    const { GET } = await import("../app/api/prompts/generation-jobs/[id]/route.js");
    const req = {} as NextRequest;
    const res = await GET(req, rid(jobId));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe(jobId);
  });

  it("GET /api/prompts/generation-jobs/[id] returns 404 for another user's job", async () => {
    await setSessionAsync(userId);
    const { GET } = await import("../app/api/prompts/generation-jobs/[id]/route.js");
    const req = {} as NextRequest;
    const res = await GET(req, rid(otherJobId));
    expect(res.status).toBe(404);
  });
});

describe("Prompt generate — groupId authorization", () => {
  const username = `apigrp_${Date.now().toString(36)}`;
  let userId: string;
  let otherGroupId: string;
  let otherUserId: string;

  beforeAll(async () => {
    const u = await registerUser({
      username,
      email: `apigrp_${Date.now().toString(36)}@example.com`,
      password: "test1234",
    });
    userId = u.user.id;

    const other = await registerUser({
      username: `apigrpo_${Date.now().toString(36)}`,
      email: `apigrpo_${Date.now().toString(36)}@example.com`,
      password: "test1234",
    });
    otherGroupId = (await createGroup(other.user.id, "别人的组")).id;
    otherUserId = other.user.id;
  });

  afterAll(async () => {
    await prisma.promptGenerationJob.deleteMany({ where: { userId: { in: [userId] } } });
    await prisma.prompt.deleteMany({ where: { userId: { in: [userId] } } });
    await prisma.promptGroup.deleteMany({ where: { userId: { in: [userId] } } });
    await prisma.quotaUsage.deleteMany({ where: { userId } });
    await prisma.userMembership.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    if (otherUserId) {
      await prisma.promptGenerationJob.deleteMany({ where: { userId: otherUserId } });
      await prisma.prompt.deleteMany({ where: { userId: otherUserId } });
      await prisma.promptGroup.deleteMany({ where: { userId: otherUserId } });
      await prisma.quotaUsage.deleteMany({ where: { userId: otherUserId } });
      await prisma.userMembership.deleteMany({ where: { userId: otherUserId } });
      await prisma.user.delete({ where: { id: otherUserId } }).catch(() => {});
    }
    clearSession();
  });

  it("POST /api/prompts/generate with another user's groupId returns 404", async () => {
    await setSessionAsync(userId);
    const jobsBefore = await prisma.promptGenerationJob.count({ where: { userId } });

    const { POST } = await import("../app/api/prompts/generate/route.js");
    const req = {
      json: async () => ({
        name: "x",
        groupId: otherGroupId,
        contentDomain: "x",
        targetAudience: "x",
        authorName: "x",
        personaDetails: "x",
        personalityTraits: ["x"],
        headingStyle: "numbered",
        wordCount: 100,
        enableAIDetectionEvasion: false,
        materialAnalysisJson: "{}",
        userNotes: "",
      }),
    } as NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(404);

    // No job was created
    const jobsAfter = await prisma.promptGenerationJob.count({ where: { userId } });
    expect(jobsAfter).toBe(jobsBefore);
  });
});
