/**
 * Phase 23B: Material track prompt tests.
 * Covers import, validation, and generation flow.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PrismaClient } from "../lib/generated/prisma/client.js";
import { importFromPaste, importFromUrl, importFromThirdParty, DuplicateMaterialError, ValidationError, queryImportedArticles } from "../lib/services/material-import.service.js";
import { createTrackPromptJob } from "../lib/services/material-track-prompt.service.js";
import { executeGenerationJob, getGenerationJob } from "../lib/services/prompt-generation.service.js";
import bcrypt from "bcryptjs";

let prisma: PrismaClient;
let userId: string;
let domainId: string;
const articleIds: string[] = [];
articleIds; // used for cleanup

beforeAll(async () => {
  const { prisma: p } = await import("../lib/db/index.js");
  prisma = p as unknown as PrismaClient;

  // Create test user directly
  const suffix = Date.now().toString(36);
  const user = await prisma.user.create({
    data: {
      username: `track_${suffix}`.slice(0, 18),
      email: `track_${suffix}@test.com`,
      passwordHash: await bcrypt.hash("TestPass123!", 10),
      role: "user",
      referralCode: `REF_${suffix}`.slice(0, 10),
      status: "active",
    },
  });
  userId = user.id;

  // Give user free plan membership for quota
  const freePlan = await prisma.membershipPlan.findFirst({ where: { code: "free" } });
  if (freePlan) {
    await prisma.userMembership.create({
      data: { userId, planId: freePlan.id, startsAt: new Date(), expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), status: "active", source: "admin" },
    });
  }

  // Get domains from seed
  const domains = await prisma.materialDomain.findMany({ take: 2, where: { parentId: null } });
  if (domains.length < 1) throw new Error("Need at least 1 domain in seed data");
  domainId = domains[0].id;
});

afterAll(async () => {
  // Cleanup
  if (articleIds.length > 0) {
    await prisma.materialArticle.deleteMany({ where: { id: { in: articleIds } } });
  }
  await prisma.prompt.deleteMany({ where: { userId } });
  await prisma.promptGenerationJob.deleteMany({ where: { userId } });
  await prisma.quotaUsage.deleteMany({ where: { userId } });
  await prisma.userMembership.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
});

const BIG_CONTENT = "测试文章正文内容，这是用于验证导入功能的示例文本。".repeat(15); // ~315 chars

describe("material-import.service", () => {
  it("paste import succeeds with valid input", async () => {
    const article = await importFromPaste(userId, { title: "测试爆文标题", content: BIG_CONTENT, domainId });
    expect(article.title).toBe("测试爆文标题");
    expect(article.fullContent).toBe(BIG_CONTENT);
    expect(article.contentLength).toBeGreaterThan(300);
    expect(article.contentHash).toBeTruthy();
    expect(article.importedByUserId).toBe(userId);
    expect(article.importSource).toBe("paste");
    expect(article.aiSuggestedDomainId).toBe(domainId);
    expect(article.aiSuggestedDomainName).toBeTruthy();
    articleIds.push(article.id);
  });

  it("paste import rejects content < 300 chars", async () => {
    await expect(importFromPaste(userId, { title: "短标题测试", content: "短".repeat(50), domainId })).rejects.toThrow("至少需要 300 字");
  });

  it("paste import rejects duplicate content hash", async () => {
    await expect(importFromPaste(userId, { title: "再试", content: BIG_CONTENT, domainId })).rejects.toThrow(DuplicateMaterialError);
  });

  it("paste import rejects missing domain", async () => {
    await expect(importFromPaste(userId, { title: "测试标题", content: BIG_CONTENT, domainId: "00000000-0000-0000-0000-000000000000" })).rejects.toThrow();
  });

  it("url import with mock fetch", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
      ok: true,
      text: async () => `<html><head><title>远程文章</title></head><body>${"<p>这是一段足够长的测试文章正文内容用来验证 URL 抓取功能是否正常工作。</p>".repeat(10)}</body></html>`,
    }));
    const article = await importFromUrl(userId, { url: "https://example.com/test-article", domainId });
    expect(article.title).toBe("远程文章");
    expect(article.importSource).toBe("url");
    expect(article.fullContent).toBeTruthy();
    expect(article.contentLength).toBeGreaterThan(300);
    articleIds.push(article.id);
    vi.unstubAllGlobals();
  });

  it("url import fails on fetch error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("Network error")));
    await expect(importFromUrl(userId, { url: "https://bad.url/no", domainId })).rejects.toThrow();
    vi.unstubAllGlobals();
  });

  it("third_party returns Chinese error", () => {
    expect(() => importFromThirdParty()).toThrow("第三方数据接口暂未配置");
  });

  it("queryImportedArticles returns articles for user", async () => {
    const { items, total } = await queryImportedArticles(userId, {});
    // Should have at least the articles from the successful import tests
    if (total === 0) {
      // Import one to verify the query works
      const a = await importFromPaste(userId, { title: "查询测试-" + Date.now(), content: BIG_CONTENT + "query", domainId });
      articleIds.push(a.id);
      const { total: t2 } = await queryImportedArticles(userId, {});
      expect(t2).toBeGreaterThanOrEqual(1);
    } else {
      expect(total).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("material-track-prompt.service", () => {
  it("rejects less than 3 articles", async () => {
    await expect(createTrackPromptJob(userId, {
      domainId, articleIds: articleIds.slice(0, 2),
      name: "测试", targetAudience: "读者", authorPersona: "作者",
    })).rejects.toThrow("至少需要选择 3 篇文章");
  });

  it("rejects more than 10 articles", async () => {
    // Create 12 unique article IDs (fake, since validation happens before DB call)
    const twelveIds = Array.from({ length: 12 }, () => "00000000-0000-0000-0000-000000000000");
    await expect(createTrackPromptJob(userId, {
      domainId,
      articleIds: twelveIds,
      name: "测试", targetAudience: "读", authorPersona: "作",
    })).rejects.toThrow("最多只能选择 10 篇文章");
  });

  it("rejects nonexistent domain", async () => {
    await expect(createTrackPromptJob(userId, {
      domainId: "00000000-0000-0000-0000-000000000000", articleIds: articleIds,
      name: "测", targetAudience: "读", authorPersona: "作",
    })).rejects.toThrow();
  });

  it("creates job with 3 articles", async () => {
    // Import 3 articles fresh
    const a1 = await importFromPaste(userId, { title: "赛1-" + Date.now(), content: BIG_CONTENT + "1".repeat(50), domainId });
    const a2 = await importFromPaste(userId, { title: "赛2-" + Date.now(), content: BIG_CONTENT + "2".repeat(50), domainId });
    const a3 = await importFromPaste(userId, { title: "赛3-" + Date.now(), content: BIG_CONTENT + "3".repeat(50), domainId });
    articleIds.push(a1.id, a2.id, a3.id);
    const three = [a1.id, a2.id, a3.id];
    const job = await createTrackPromptJob(userId, {
      domainId, articleIds: three,
      name: "赛道提示词测试", targetAudience: "财经读者", authorPersona: "分析型作者",
    });
    expect(job.status).toBe("pending");
    expect((job.input as Record<string, unknown>).mode).toBe("track_prompt_from_materials");

    // Simulate worker claim
    await prisma.promptGenerationJob.update({
      where: { id: job.id },
      data: { status: "running", startedAt: new Date(), attempts: { increment: 1 } },
    });

    await executeGenerationJob(job.id);

    const updated = await getGenerationJob(job.id, userId);
    expect(updated!.status).toBe("completed");
    expect(updated!.outputPromptId).toBeTruthy();

    const prompt = await prisma.prompt.findUnique({ where: { id: updated!.outputPromptId! } });
    expect(prompt).not.toBeNull();
    expect(prompt!.sourceType).toBe("material_track_generated");
    expect(prompt!.visibility).toBe("private");
    const config = prompt!.config as Record<string, unknown> | null;
    expect(config).toBeTruthy();
    expect(config!.articleIds).toEqual(three);
    expect(config!.trackInsights).toBeTruthy();
  });
});
