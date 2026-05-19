import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "../lib/db/prisma.js";
import { registerUser } from "../lib/services/auth.service.js";
import { signToken } from "../lib/auth/session.js";

// Mock next/headers for route handler tests
const cookieStore: Record<string, string> = {};
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

async function setSession(userId: string, role = "user") {
  cookieStore["baoleme_session"] = await signToken({ userId, role });
}

describe("requireAuth: user-not-found vs DB error", () => {
  const un = `ae_${Date.now().toString(36)}`;
  let userId: string;

  beforeAll(async () => {
    const r = await registerUser({ username: un, email: `ae_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) });
    userId = r.user.id;
  });
  afterAll(async () => {
    await prisma.quotaUsage.deleteMany({ where: { userId } });
    await prisma.userMembership.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it("valid user → 200", async () => {
    await setSession(userId);
    const { GET } = await import("../app/api/auth/me/route.js");
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it("deleted user → 401 '用户不存在'", async () => {
    await prisma.quotaUsage.deleteMany({ where: { userId } });
    await prisma.userMembership.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await setSession(userId);
    const { GET } = await import("../app/api/auth/me/route.js");
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.message).toBe("用户不存在");
  });

  it("DB error does NOT become 401 user-not-found — it throws as 500", async () => {
    // Mock the lazy-loaded @/lib/db to throw a simulated DB error
    vi.doMock("@/lib/db", () => ({
      prisma: {
        user: {
          findUnique: vi.fn().mockRejectedValue(new Error("db connection lost")),
        },
      },
    }));

    await setSession(userId);

    const { requireAuth } = await import("../lib/auth/session.js");
    try {
      await requireAuth();
      expect.unreachable("requireAuth should have thrown the DB error upward");
    } catch (e) {
      // Must be the raw DB error, NOT an AuthError
      expect((e as Error).message).toBe("db connection lost");
      expect((e as Error).message).not.toBe("用户不存在");
      expect((e as { code?: string }).code).not.toBe("UNAUTHORIZED");
    }

    vi.resetModules();
  });
});
