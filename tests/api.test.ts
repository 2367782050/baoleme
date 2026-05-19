/**
 * API-level integration tests.
 *
 * These tests call the Next.js Route Handler functions directly (imported as
 * plain functions) and simulate cookie state by stubbing next/headers.
 * Request objects are cast to NextRequest since route handlers expect
 * the Next.js extended request type.
 *
 * This avoids the overhead of spinning up a full HTTP server while still
 * verifying the actual route handler logic, response codes, cookie behaviour,
 * and error messages.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { NextRequest } from "next/server";
import { prisma } from "../lib/db/prisma.js";
import { registerUser } from "../lib/services/auth.service.js";
import { signToken, verifyToken } from "../lib/auth/session.js";

// ── Cookie mock ──────────────────────────────────────────────────
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

// Dynamic imports must happen AFTER the mock
async function callMeApi(): Promise<{ status: number; body: unknown }> {
  const { GET } = await import("../app/api/auth/me/route.js");
  const res = await GET();
  return { status: res.status, body: await res.json() };
}

async function callLoginApi(body: Record<string, unknown>): Promise<{ status: number; body: unknown }> {
  const { POST } = await import("../app/api/auth/login/route.js");
  const req = { json: async () => body } as NextRequest;
  const res = await POST(req);
  return { status: res.status, body: await res.json() };
}

async function callLogoutApi(): Promise<{ status: number; body: unknown }> {
  const { POST } = await import("../app/api/auth/logout/route.js");
  const res = await POST();
  return { status: res.status, body: await res.json() };
}

async function callSendCodeApi(body: Record<string, unknown>): Promise<{ status: number; body: unknown }> {
  const { POST } = await import("../app/api/auth/send-email-code/route.js");
  const req = { json: async () => body } as NextRequest;
  const res = await POST(req);
  return { status: res.status, body: await res.json() };
}

async function callRegisterApi(body: Record<string, unknown>): Promise<{ status: number; body: unknown }> {
  const { POST } = await import("../app/api/auth/register/route.js");
  const req = { json: async () => body } as NextRequest;
  const res = await POST(req);
  return { status: res.status, body: await res.json() };
}

async function callPlansApi(): Promise<{ status: number; body: unknown }> {
  const { GET } = await import("../app/api/membership/plans/route.js");
  const res = await GET();
  return { status: res.status, body: await res.json() };
}

async function callCurrentApi(): Promise<{ status: number; body: unknown }> {
  const { GET } = await import("../app/api/membership/current/route.js");
  const res = await GET();
  return { status: res.status, body: await res.json() };
}

async function callQuotaApi(): Promise<{ status: number; body: unknown }> {
  const { GET } = await import("../app/api/membership/quota/route.js");
  const res = await GET();
  return { status: res.status, body: await res.json() };
}

describe("API: /api/auth/me (unauthenticated)", () => {
  it("returns 401 UNAUTHORIZED when no session cookie", async () => {
    cookieStore = {};
    const { status, body } = await callMeApi();
    expect(status).toBe(401);
    expect((body as { success: boolean }).success).toBe(false);
    expect((body as { error: { code: string } }).error.code).toBe("UNAUTHORIZED");
  });
});

describe("API: /api/auth/send-email-code", () => {
  const testEmail = `api_code_${Date.now()}@example.com`;

  afterAll(async () => {
    await prisma.emailVerificationCode.deleteMany({ where: { email: testEmail } });
  });

  it("returns code in dev environment", async () => {
    const { status, body } = await callSendCodeApi({
      email: testEmail,
      purpose: "register",
    });
    expect(status).toBe(200);
    expect((body as { success: boolean }).success).toBe(true);
    const data = (body as { data: { code?: string } }).data;
    // In dev, code should be returned
    expect(data.code).toMatch(/^\d{6}$/);
  });

  it("rejects invalid email", async () => {
    const { status, body } = await callSendCodeApi({
      email: "not-an-email",
      purpose: "register",
    });
    expect(status).toBe(400);
    expect((body as { success: boolean }).success).toBe(false);
  });
});

describe("API: full auth flow (register → login → me → logout → me)", () => {
  const testUsername = `apir${Date.now().toString(36)}`;
  const testEmail = `api${Date.now().toString(36)}@example.com`;
  const testPassword = "testpass123";
  let createdUserId: string;
  let capturedCode: string;

  afterAll(async () => {
    if (createdUserId) {
      await prisma.quotaUsage.deleteMany({ where: { userId: createdUserId } });
      await prisma.userMembership.deleteMany({ where: { userId: createdUserId } });
      await prisma.user.delete({ where: { id: createdUserId } }).catch(() => {});
    }
    cookieStore = {};
  });

  it("step 1: send email code", async () => {
    const { status, body } = await callSendCodeApi({
      email: testEmail,
      purpose: "register",
    });
    expect(status).toBe(200);
    const code = (body as { data: { code: string } }).data.code;
    expect(code).toMatch(/^\d{6}$/);
    capturedCode = code;
  });

  it("step 2: register sets baoleme_session cookie", async () => {
    cookieStore = {};

    const { status, body } = await callRegisterApi({
      username: testUsername,
      email: testEmail,
      password: testPassword,
      emailCode: capturedCode,
    });

    expect(status).toBe(200);
    expect((body as { success: boolean }).success).toBe(true);
    const data = (body as { data: { user: { id: string; username: string; email: string; role: string } } }).data;
    createdUserId = data.user.id;
    expect(data.user.username).toBe(testUsername);

    // Verify cookie was set
    expect(cookieStore["baoleme_session"]).toBeTruthy();

    // Verify the token is a valid JWT
    const token = cookieStore["baoleme_session"];
    const payload = await verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.userId).toBe(createdUserId);
  });

  it("step 3: POST /api/auth/me returns user + membership + quota", async () => {
    const { status, body } = await callMeApi();
    expect(status).toBe(200);
    expect((body as { success: boolean }).success).toBe(true);
    const data = (body as {
      data: {
        user: { username: string; email: string; role: string };
        membership: { planCode: string; status: string } | null;
        quota: Record<string, { used: number; limit: number }>;
      };
    }).data;

    expect(data.user.username).toBe(testUsername);
    expect(data.user.role).toBe("user");
    expect(data.membership).not.toBeNull();
    expect(data.membership!.planCode).toBe("free");
    expect(data.quota.article_generate).toBeDefined();
  });

  it("step 4: logout clears cookie", async () => {
    const { status, body } = await callLogoutApi();
    expect(status).toBe(200);
    expect((body as { success: boolean }).success).toBe(true);

    // Cookie should be cleared (set to empty)
    expect(cookieStore["baoleme_session"]).toBe("");
  });

  it("step 5: /api/auth/me after logout returns 401", async () => {
    const { status, body } = await callMeApi();
    expect(status).toBe(401);
    expect((body as { success: boolean }).success).toBe(false);
    expect((body as { error: { code: string } }).error.code).toBe("UNAUTHORIZED");
  });
});

describe("API: login with username or email", () => {
  const testUsername = `aplg${Date.now().toString(36)}`;
  const testEmail = `aplg${Date.now().toString(36)}@example.com`;
  const testPassword = "securepass123";
  let createdUserId: string;

  beforeAll(async () => {
    cookieStore = {};
    const result = await registerUser({
      username: testUsername,
      email: testEmail,
      password: testPassword,
    });
    createdUserId = result.user.id;
  });

  afterAll(async () => {
    if (createdUserId) {
      await prisma.quotaUsage.deleteMany({ where: { userId: createdUserId } });
      await prisma.userMembership.deleteMany({ where: { userId: createdUserId } });
      await prisma.user.delete({ where: { id: createdUserId } }).catch(() => {});
    }
    cookieStore = {};
  });

  it("login with username sets cookie", async () => {
    cookieStore = {};
    const { status, body } = await callLoginApi({
      account: testUsername,
      password: testPassword,
    });
    expect(status).toBe(200);
    expect((body as { success: boolean }).success).toBe(true);
    expect(cookieStore["baoleme_session"]).toBeTruthy();
  });

  it("login with email sets cookie", async () => {
    cookieStore = {};
    const { status, body } = await callLoginApi({
      account: testEmail,
      password: testPassword,
    });
    expect(status).toBe(200);
    expect((body as { success: boolean }).success).toBe(true);
    expect(cookieStore["baoleme_session"]).toBeTruthy();
  });

  it("login with wrong password returns 401", async () => {
    cookieStore = {};
    const { status, body } = await callLoginApi({
      account: testUsername,
      password: "wrongpassword",
    });
    expect(status).toBe(401);
    expect((body as { success: boolean }).success).toBe(false);
  });
});

describe("API: membership endpoints", () => {
  const testUsername = `apmm${Date.now().toString(36)}`;
  const testEmail = `apmm${Date.now().toString(36)}@example.com`;
  const testPassword = "memtest123";
  let createdUserId: string;

  beforeAll(async () => {
    cookieStore = {};
    const result = await registerUser({
      username: testUsername,
      email: testEmail,
      password: testPassword,
    });
    createdUserId = result.user.id;
    // Set session cookie for subsequent calls
    const token = await signToken({ userId: createdUserId, role: result.user.role });
    cookieStore["baoleme_session"] = token;
  });

  afterAll(async () => {
    if (createdUserId) {
      await prisma.quotaUsage.deleteMany({ where: { userId: createdUserId } });
      await prisma.userMembership.deleteMany({ where: { userId: createdUserId } });
      await prisma.user.delete({ where: { id: createdUserId } }).catch(() => {});
    }
    cookieStore = {};
  });

  it("GET /api/membership/plans returns 3 plans", async () => {
    const { status, body } = await callPlansApi();
    expect(status).toBe(200);
    const items = (body as { data: unknown[] }).data;
    expect(items.length).toBeGreaterThanOrEqual(3);
  });

  it("GET /api/membership/current returns free membership", async () => {
    const { status, body } = await callCurrentApi();
    expect(status).toBe(200);
    const data = (body as { data: { membership: { planCode: string } | null } }).data;
    expect(data.membership).not.toBeNull();
    expect(data.membership!.planCode).toBe("free");
  });

  it("GET /api/membership/current returns 401 when unauthenticated", async () => {
    cookieStore = {};
    const { status } = await callCurrentApi();
    expect(status).toBe(401);
  });

  it("GET /api/membership/quota returns 6 capabilities with remaining >= 0", async () => {
    // Re-set cookie since we cleared it above
    const token = await signToken({ userId: createdUserId, role: "user" });
    cookieStore["baoleme_session"] = token;

    const { status, body } = await callQuotaApi();
    expect(status).toBe(200);
    const quota = (body as { data: Record<string, { used: number; limit: number; remaining: number }> }).data;
    const keys = Object.keys(quota);
    expect(keys.length).toBe(6);
    for (const key of keys) {
      expect(quota[key].remaining).toBeGreaterThanOrEqual(0);
    }
  });
});
