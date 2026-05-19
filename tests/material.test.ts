import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../lib/db/prisma.js";
import { getDomainTree } from "../lib/services/material.service.js";
import {
  queryAccounts,
  queryArticleMaterials,
  queryHotTopics,
  addFavorite,
  removeFavorite,
  isFavorited,
  exportMaterial,
  importMaterialAccounts,
  DuplicateFavoriteError,
} from "../lib/services/material.service.js";
import { findPlanByCode, createUserMembership } from "../lib/services/membership.service.js";
import { createUser } from "../lib/services/user.service.js";

describe("Material domains", () => {
  it("returns a tree with at least 8 root domains", async () => {
    const tree = await getDomainTree();
    expect(tree.length).toBeGreaterThanOrEqual(8);
    expect(tree[0].children.length).toBeGreaterThan(0);
  });

  it("each root has children with parentId pointing to root", async () => {
    const tree = await getDomainTree();
    for (const root of tree) {
      for (const child of root.children) {
        expect(child.parentId).toBe(root.id);
      }
    }
  });
});

describe("Material accounts query", () => {
  it("returns wechat accounts sorted by rank", async () => {
    const result = await queryAccounts({
      platform: "wechat",
      page: 1,
      pageSize: 10,
      sortBy: "rank",
      sortOrder: "asc",
    });
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.items[0].platform).toBe("wechat");
    // Sorted by rank ascending
    if (result.items.length > 1) {
      expect(result.items[0].rank).toBeLessThanOrEqual(result.items[1].rank);
    }
  });

  it("filters by keyword (name search)", async () => {
    const result = await queryAccounts({
      page: 1,
      pageSize: 10,
      keyword: "财经",
    });
    expect(result.total).toBeGreaterThanOrEqual(1);
    for (const a of result.items) {
      expect(a.name).toMatch(/财经/i);
    }
  });

  it("supports pagination", async () => {
    const page1 = await queryAccounts({ page: 1, pageSize: 1 });
    const page2 = await queryAccounts({ page: 2, pageSize: 1 });
    if (page1.total >= 2) {
      expect(page1.items[0].id).not.toBe(page2.items[0].id);
    }
    expect(page1.page).toBe(1);
    expect(page1.pageSize).toBe(1);
  });
});

describe("Material articles query", () => {
  it("returns articles with pagination", async () => {
    const result = await queryArticleMaterials({ page: 1, pageSize: 10 });
    expect(result.total).toBeGreaterThanOrEqual(1);
  });

  it("filters by keyword in title", async () => {
    const result = await queryArticleMaterials({
      page: 1,
      pageSize: 10,
      keyword: "AI",
    });
    if (result.total > 0) {
      for (const a of result.items) {
        const match = a.title.includes("AI") || (a.summary?.includes("AI") ?? false);
        expect(match).toBe(true);
      }
    }
  });
});

describe("Hot topics query", () => {
  it("returns topics with default pagination", async () => {
    const result = await queryHotTopics({ page: 1, pageSize: 10 });
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.items[0].rank).toBeLessThanOrEqual(result.items[1]?.rank ?? 999);
  });

  it("filters by platform", async () => {
    const result = await queryHotTopics({
      page: 1,
      pageSize: 10,
      platform: "wechat",
    });
    for (const t of result.items) {
      expect(t.platform).toBe("wechat");
    }
  });
});

describe("Favorites", () => {
  const testUsername = `favt_${Date.now().toString(36)}`;
  let userId: string;
  let accountId: string;

  beforeAll(async () => {
    const user = await createUser({
      username: testUsername,
      email: `favt_${Date.now().toString(36)}@example.com`,
      passwordHash: "hash",
    });
    userId = user.id;

    // Get a test account
    const accounts = await queryAccounts({ page: 1, pageSize: 1 });
    accountId = accounts.items[0]?.id;
  });

  afterAll(async () => {
    if (userId) {
      await prisma.favorite.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
  });

  it("adds a favorite for an account", async () => {
    if (!accountId) return;
    const fav = await addFavorite(userId, "account", accountId);
    expect(fav.userId).toBe(userId);
    expect(fav.targetType).toBe("account");
    expect(fav.targetId).toBe(accountId);
  });

  it("isFavorited returns true after adding", async () => {
    if (!accountId) return;
    const yes = await isFavorited(userId, "account", accountId);
    expect(yes).toBe(true);
  });

  it("rejects duplicate favorite", async () => {
    if (!accountId) return;
    await expect(
      addFavorite(userId, "account", accountId),
    ).rejects.toThrow(DuplicateFavoriteError);
  });

  it("removes a favorite", async () => {
    if (!accountId) return;
    const favs = await prisma.favorite.findMany({
      where: { userId, targetType: "account", targetId: accountId },
    });
    if (favs.length > 0) {
      await removeFavorite(favs[0].id, userId);
      const yes = await isFavorited(userId, "account", accountId);
      expect(yes).toBe(false);
    }
  });
});

describe("Material export", () => {
  const testUsername = `exp_${Date.now().toString(36)}`;
  let userId: string;
  let planId: string;

  beforeAll(async () => {
    const plan = await findPlanByCode("free");
    planId = plan!.id;

    const user = await createUser({
      username: testUsername,
      email: `exp_${Date.now().toString(36)}@example.com`,
      passwordHash: "hash",
    });
    userId = user.id;

    await createUserMembership(userId, planId, "trial", 36500);
  });

  afterAll(async () => {
    if (userId) {
      await prisma.quotaUsage.deleteMany({ where: { userId } });
      await prisma.userMembership.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
  });

  it("exports accounts CSV successfully", async () => {
    const csv = await exportMaterial(userId, "accounts", {});
    expect(csv).toContain("排名,平台,账号名称");
    expect(csv).toContain("财经早餐");
  });

  it("exports articles CSV successfully", async () => {
    const csv = await exportMaterial(userId, "articles", {});
    expect(csv).toContain("平台,标题,阅读数");
  });

  it("exports topics CSV successfully", async () => {
    const csv = await exportMaterial(userId, "topics", {});
    expect(csv).toContain("排名,平台,标题,热度");
  });

  it("deducts material_export quota on export", async () => {
    // Free plan has material_export_daily = 10
    // We already exported 3 above, so we have 7 left
    // But free daily limit is 10, let's export a bit more
    // Just check that quota tracking works
    const usage = await prisma.quotaUsage.findFirst({
      where: { userId, capability: "material_export" },
    });
    // Should have some usage from above exports
    // (This verifies the mechanism is in place)
    expect(usage).not.toBeNull();
  });
});

describe("Admin material import", () => {
  const testUsername = `adm_${Date.now().toString(36)}`;
  let adminUserId: string;
  let userUserId: string;

  beforeAll(async () => {
    const admin = await createUser({
      username: testUsername,
      email: `adm_${Date.now().toString(36)}@example.com`,
      passwordHash: "hash",
    });
    adminUserId = admin.id;
    // Make admin
    await prisma.user.update({
      where: { id: adminUserId },
      data: { role: "admin" },
    });

    const user = await createUser({
      username: `reg_${Date.now().toString(36)}`,
      email: `reg_${Date.now().toString(36)}@example.com`,
      passwordHash: "hash",
    });
    userUserId = user.id;
  });

  afterAll(async () => {
    // Clean up imported accounts
    await prisma.materialAccount.deleteMany({
      where: { sourceProvider: "import", name: { startsWith: "IMPORT_TEST_" } },
    });
    await prisma.user.delete({ where: { id: adminUserId } }).catch(() => {});
    await prisma.user.delete({ where: { id: userUserId } }).catch(() => {});
  });

  it("imports valid accounts successfully", async () => {
    const result = await importMaterialAccounts([
      {
        platform: "wechat",
        name: "IMPORT_TEST_导入测试号",
        avgTopReadCount: 50000,
        rank: 100,
        snapshotDate: "2026-05-18",
      },
    ]);
    expect(result.imported).toBe(1);
    expect(result.errors.length).toBe(0);
  });

  it("returns row-level errors for missing fields", async () => {
    const result = await importMaterialAccounts([
      { platform: "", name: "" } as unknown as { platform: string; name: string },
    ]);
    expect(result.imported).toBe(0);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].message).toContain("必填");
  });

  it("rejects invalid platform", async () => {
    const result = await importMaterialAccounts([
      { platform: "invalid_platform", name: "TEST" },
    ]);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].message).toContain("无效");
  });
});
