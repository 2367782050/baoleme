/**
 * Material API-level integration tests.
 *
 * Same pattern as api.test.ts: mock next/headers cookies,
 * import route handlers directly, verify HTTP-level behavior.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { NextRequest } from "next/server";
import { prisma } from "../lib/db/prisma.js";
import { registerUser } from "../lib/services/auth.service.js";
import { signToken } from "../lib/auth/session.js";

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

async function setSessionAsync(userId: string, role: string = "user") {
  cookieStore["baoleme_session"] = await signToken({ userId, role });
}
function clearSession() {
  cookieStore = {};
}

// ── API call helpers ─────────────────────────────────────────────

async function callDomainsApi(): Promise<{ status: number; body: unknown }> {
  const { GET } = await import("../app/api/material/domains/route.js");
  const res = await GET();
  return { status: res.status, body: await res.json() };
}

async function callAccountsApi(): Promise<{ status: number; body: unknown }> {
  const { GET } = await import("../app/api/material/accounts/route.js");
  const req = { nextUrl: new URL("http://localhost/api/material/accounts?page=1&pageSize=3") } as unknown as NextRequest;
  const res = await GET(req);
  return { status: res.status, body: await res.json() };
}

async function callAddFavoriteApi(targetType: string, targetId: string): Promise<{ status: number; body: unknown }> {
  const { POST } = await import("../app/api/material/favorites/route.js");
  const req = { json: async () => ({ targetType, targetId }) } as NextRequest;
  const res = await POST(req);
  return { status: res.status, body: await res.json() };
}

async function callRemoveFavoriteApi(id: string): Promise<{ status: number; body: unknown }> {
  const { DELETE } = await import("../app/api/material/favorites/route.js");
  const req = { nextUrl: new URL(`http://localhost/api/material/favorites?id=${id}`) } as unknown as NextRequest;
  const res = await DELETE(req);
  return { status: res.status, body: await res.json() };
}

async function callExportApi(type: string): Promise<{ status: number; body: unknown }> {
  const { POST } = await import("../app/api/material/export/route.js");
  const req = { json: async () => ({ type, filters: {} }) } as NextRequest;
  const res = await POST(req);
  return { status: res.status, body: await res.json() };
}

async function callImportApi(data: unknown[]): Promise<{ status: number; body: unknown }> {
  const { POST } = await import("../app/api/admin/material/import/route.js");
  const req = { json: async () => ({ data }) } as NextRequest;
  const res = await POST(req);
  return { status: res.status, body: await res.json() };
}

// ── Tests ────────────────────────────────────────────────────────

describe("GET /api/material/domains", () => {
  it("returns domain tree with status 200", async () => {
    const { status, body } = await callDomainsApi();
    expect(status).toBe(200);
    const data = (body as { data: unknown[] }).data;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(8);
  });
});

describe("GET /api/material/accounts", () => {
  it("returns paginated accounts", async () => {
    const { status, body } = await callAccountsApi();
    expect(status).toBe(200);
    const data = (body as { data: { items: unknown[]; total: number; page: number } }).data;
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.total).toBeGreaterThanOrEqual(1);
    expect(data.page).toBe(1);
  });
});

describe("POST /api/material/favorites", () => {
  let userId: string;
  let accountId: string;

  beforeAll(async () => {
    // Create a test user
    const result = await registerUser({
      username: `matfav_${Date.now().toString(36)}`,
      email: `matfav_${Date.now().toString(36)}@example.com`,
      password: "test1234",
    });
    userId = result.user.id;

    const accounts = await prisma.materialAccount.findMany({ take: 1 });
    accountId = accounts[0]?.id ?? "";
  });

  afterAll(async () => {
    if (userId) {
      await prisma.favorite.deleteMany({ where: { userId } });
      await prisma.quotaUsage.deleteMany({ where: { userId } });
      await prisma.userMembership.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
    clearSession();
  });

  it("returns 401 when not logged in", async () => {
    clearSession();
    const { status, body } = await callAddFavoriteApi("account", accountId);
    expect(status).toBe(401);
    expect((body as { success: boolean }).success).toBe(false);
  });

  it("returns 200 when logged in and favorite succeeds", async () => {
    await setSessionAsync(userId);
    const { status, body } = await callAddFavoriteApi("account", accountId);
    expect(status).toBe(200);
    expect((body as { success: boolean }).success).toBe(true);
  });

  it("returns 409 on duplicate favorite", async () => {
    await setSessionAsync(userId);
    const { status, body } = await callAddFavoriteApi("account", accountId);
    expect(status).toBe(409);
    expect((body as { error: { code: string } }).error.code).toBe("DUPLICATE_FAVORITE");
  });
});

describe("DELETE /api/material/favorites", () => {
  let userId: string;
  let accountId: string;

  beforeAll(async () => {
    const result = await registerUser({
      username: `matdel_${Date.now().toString(36)}`,
      email: `matdel_${Date.now().toString(36)}@example.com`,
      password: "test1234",
    });
    userId = result.user.id;

    const accounts = await prisma.materialAccount.findMany({ take: 1 });
    accountId = accounts[0]?.id ?? "";

    // Pre-create a favorite
    if (accountId) {
      await prisma.favorite.create({
        data: { userId, targetType: "account", targetId: accountId },
      });
    }
  });

  afterAll(async () => {
    if (userId) {
      await prisma.favorite.deleteMany({ where: { userId } });
      await prisma.quotaUsage.deleteMany({ where: { userId } });
      await prisma.userMembership.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
    clearSession();
  });

  it("returns 200 and removes favorite when logged in", async () => {
    await setSessionAsync(userId);
    const favs = await prisma.favorite.findMany({ where: { userId } });
    expect(favs.length).toBeGreaterThanOrEqual(1);

    const { status, body } = await callRemoveFavoriteApi(favs[0].id);
    expect(status).toBe(200);
    expect((body as { success: boolean }).success).toBe(true);

    const after = await prisma.favorite.findMany({ where: { userId } });
    expect(after.length).toBe(favs.length - 1);
  });
});

describe("POST /api/material/export", () => {
  let userId: string;

  beforeAll(async () => {
    const result = await registerUser({
      username: `matexp_${Date.now().toString(36)}`,
      email: `matexp_${Date.now().toString(36)}@example.com`,
      password: "test1234",
    });
    userId = result.user.id;
  });

  afterAll(async () => {
    if (userId) {
      await prisma.quotaUsage.deleteMany({ where: { userId } });
      await prisma.userMembership.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
    clearSession();
  });

  it("returns 401 when not logged in", async () => {
    clearSession();
    const { status, body } = await callExportApi("accounts");
    expect(status).toBe(401);
    expect((body as { success: boolean }).success).toBe(false);
  });

  it("returns csv data and deducts quota when logged in", async () => {
    await setSessionAsync(userId);
    const { status, body } = await callExportApi("accounts");
    expect(status).toBe(200);
    const data = (body as { data: { csv: string } }).data;
    expect(data.csv).toContain("排名,平台,账号名称");

    // Verify quota was consumed
    const usage = await prisma.quotaUsage.findFirst({
      where: { userId, capability: "material_export" },
    });
    expect(usage).not.toBeNull();
    expect(usage!.used).toBeGreaterThanOrEqual(1);
  });
});

describe("POST /api/admin/material/import", () => {
  let adminUserId: string;
  let regularUserId: string;

  beforeAll(async () => {
    // Create admin user
    const adminResult = await registerUser({
      username: `matadm_${Date.now().toString(36)}`,
      email: `matadm_${Date.now().toString(36)}@example.com`,
      password: "test1234",
    });
    adminUserId = adminResult.user.id;
    await prisma.user.update({
      where: { id: adminUserId },
      data: { role: "admin" },
    });

    // Create regular user
    const userResult = await registerUser({
      username: `matusr_${Date.now().toString(36)}`,
      email: `matusr_${Date.now().toString(36)}@example.com`,
      password: "test1234",
    });
    regularUserId = userResult.user.id;
  });

  afterAll(async () => {
    // Clean up imported test data
    await prisma.materialAccount.deleteMany({
      where: { sourceProvider: "import", name: { startsWith: "API_TEST_IMPORT_" } },
    });
    if (adminUserId) {
      await prisma.quotaUsage.deleteMany({ where: { userId: adminUserId } });
      await prisma.userMembership.deleteMany({ where: { userId: adminUserId } });
      await prisma.user.delete({ where: { id: adminUserId } }).catch(() => {});
    }
    if (regularUserId) {
      await prisma.quotaUsage.deleteMany({ where: { userId: regularUserId } });
      await prisma.userMembership.deleteMany({ where: { userId: regularUserId } });
      await prisma.user.delete({ where: { id: regularUserId } }).catch(() => {});
    }
    clearSession();
  });

  it("returns 401 when not logged in", async () => {
    clearSession();
    const { status, body } = await callImportApi([
      { platform: "wechat", name: "TEST" },
    ]);
    expect(status).toBe(401);
    expect((body as { success: boolean }).success).toBe(false);
  });

  it("returns 403 when logged in as regular user", async () => {
    await setSessionAsync(regularUserId);
    const { status, body } = await callImportApi([
      { platform: "wechat", name: "TEST" },
    ]);
    expect(status).toBe(403);
    expect((body as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  it("returns 200 and imports when logged in as admin", async () => {
    await setSessionAsync(adminUserId, "admin");
    const { status, body } = await callImportApi([
      { platform: "wechat", name: "API_TEST_IMPORT_OK", avgTopReadCount: 10000, rank: 50 },
    ]);
    expect(status).toBe(200);
    expect((body as { success: boolean }).success).toBe(true);
    const data = (body as { data: { imported: number; errors: unknown[] } }).data;
    expect(data.imported).toBe(1);
  });

  it("returns row-level errors for invalid data", async () => {
    await setSessionAsync(adminUserId, "admin");
    const { status, body } = await callImportApi([
      { platform: "wechat", name: "API_TEST_IMPORT_OK2", avgTopReadCount: 5000, rank: 60 },
      { platform: "", name: "" },
      { platform: "invalid_platform", name: "Bad" },
    ]);
    expect(status).toBe(200);
    const data = (body as { data: { imported: number; errors: { row: number; message: string }[] } }).data;
    expect(data.imported).toBeGreaterThanOrEqual(1);
    expect(data.errors.length).toBeGreaterThanOrEqual(2);
  });
});
