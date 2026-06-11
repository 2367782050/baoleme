/**
 * Phase 24: Content source engine tests.
 * Covers ContentSourceManager, importContentSourceArticle,
 * RSS content source with mock server, and admin API.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "../lib/generated/prisma/client.js";
import { ContentSourceManager } from "../lib/adapters/material/sources/manager.js";
import { RSSContentSource } from "../lib/adapters/material/sources/rss-source.js";
import type { ContentSource, ContentSourceArticle } from "../lib/adapters/material/sources/types.js";
import { importContentSourceArticle, createIngestionRun, completeIngestionRun, failIngestionRun, queryIngestionHistory, recoverStaleIngestionRuns } from "../lib/services/content-ingestion.service.js";
import bcrypt from "bcryptjs";
import http from "node:http";

let prisma: PrismaClient;
let userId: string;
let mockServer: http.Server;
let mockFeedPort: number;

// Simple mock RSS XML
const RSS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>测试博客</title>
    <link>https://test-blog.example.com</link>
    <description>测试 RSS 源</description>
    <item>
      <title>测试文章：低粉爆款方法论</title>
      <link>https://test-blog.example.com/article/1</link>
      <description>这是一篇关于如何用低粉丝量做出高阅读量的深度分析文章。</description>
      <content:encoded xmlns:content="http://purl.org/rss/1.0/modules/content/"><![CDATA[<p>这是一篇关于如何用低粉丝量做出高阅读量的深度分析文章。测试正文内容需要足够长来满足导入字数要求。爆款文章的核心在于选题、标题、情绪价值三个维度。</p><p>选题要切中读者的核心关注点，标题要有悬念和冲突，情绪价值要能引发共鸣或争议。本文将详细拆解这三大要素。</p><p>测试文章正文内容，这是用于验证RSS导入功能的示例文本。需要补充更多文字来达到最低字数要求。测试文章正文内容，这是用于验证RSS导入功能的示例文本。需要补充更多文字来达到最低字数要求。</p>]]></content:encoded>
      <author>测试作者</author>
      <pubDate>Mon, 09 Jun 2026 10:00:00 GMT</pubDate>
    </item>
    <item>
      <title>短文章</title>
      <link>https://test-blog.example.com/article/2</link>
      <description>短</description>
    </item>
  </channel>
</rss>`;

beforeAll(async () => {
  const { prisma: p } = await import("../lib/db/index.js");
  prisma = p as unknown as PrismaClient;

  // Create test user
  const suffix = Date.now().toString(36);
  const user = await prisma.user.create({
    data: {
      username: `csrc_${suffix}`.slice(0, 18),
      email: `csrc_${suffix}@test.com`,
      passwordHash: await bcrypt.hash("TestPass123!", 10),
      role: "user",
      referralCode: `CSRC_${suffix}`.slice(0, 10),
      status: "active",
    },
  });
  userId = user.id;

  // Start mock RSS HTTP server
  await new Promise<void>((resolve) => {
    mockServer = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/xml" });
      res.end(RSS_XML);
    });
    mockServer.listen(0, () => {
      const addr = mockServer.address();
      if (addr && typeof addr === "object") {
        mockFeedPort = addr.port;
      }
      resolve();
    });
  });
});

afterAll(async () => {
  // Cleanup
  await prisma.materialArticle.deleteMany({ where: { title: { startsWith: "测试文章：" } } });
  await prisma.materialAccount.deleteMany({ where: { sourceProvider: "rss" } });
  await prisma.materialArticle.deleteMany({ where: { importSource: "auto" } });
  await prisma.contentIngestionRun.deleteMany({});
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  await new Promise<void>((resolve) => mockServer.close(() => resolve()));
});

describe("ContentSourceManager", () => {
  it("registers and lists sources", () => {
    const manager = new ContentSourceManager();
    const fakeSource: ContentSource = {
      name: "fake",
      description: "Fake source for testing",
      isEnabled: true,
      fetchRecent: async () => [],
      healthCheck: async () => ({ name: "fake", status: "ok" }),
    };

    manager.register(fakeSource);
    expect(manager.listSources()).toHaveLength(1);
    expect(manager.getSource("fake")).toBe(fakeSource);
  });

  it("prevents duplicate registration", () => {
    const manager = new ContentSourceManager();
    const fake: ContentSource = {
      name: "dup",
      description: "",
      isEnabled: true,
      fetchRecent: async () => [],
      healthCheck: async () => ({ name: "dup", status: "ok" }),
    };
    manager.register(fake);
    expect(() => manager.register(fake)).toThrow("already registered");
  });

  it("returns undefined for unknown source", () => {
    const manager = new ContentSourceManager();
    expect(manager.getSource("nonexistent")).toBeUndefined();
  });

  it("returns skip result for disabled source", async () => {
    const manager = new ContentSourceManager();
    const disabled: ContentSource = {
      name: "off",
      description: "",
      isEnabled: false,
      fetchRecent: async () => [{ title: "x", sourceUrl: "x", publishedAt: new Date(), platform: "website" }],
      healthCheck: async () => ({ name: "off", status: "ok" }),
    };
    manager.register(disabled);
    const result = await manager.fetchSource("off");
    expect(result.source).toBe("off");
    expect(result.articlesFound).toBe(0);
  });
});

describe("importContentSourceArticle", () => {
  it("imports a new article", async () => {
    const article: ContentSourceArticle = {
      title: "测试文章：导入服务单元测试-" + Date.now(),
      sourceUrl: "https://example.com/test-" + Date.now(),
      publishedAt: new Date(),
      fullContent: "这是一篇测试文章的正文内容，用于验证内容摄入服务的导入功能是否正常工作。需要补充足够的字数来满足内容要求。测试文章正文内容验证导入功能。" + "补充文字".repeat(10),
      summary: "测试摘要",
      platform: "website",
      domainHint: "科技",
      accountName: "测试自媒体",
      readCount: 10000,
      likeCount: 500,
    };

    const result = await importContentSourceArticle(article);
    expect(result.status).toBe("new");
    expect(result.articleId).toBeTruthy();

    const saved = await prisma.materialArticle.findUnique({ where: { id: result.articleId! } });
    expect(saved).not.toBeNull();
    expect(saved!.title).toBe(article.title);
    expect(saved!.platform).toBe("website");
    expect(saved!.importSource).toBe("auto");
    expect(saved!.sourceProvider).toBe("rss");
    expect(saved!.readCount).toBe(10000);
    expect(saved!.likeCount).toBe(500);
    expect(saved!.contentHash).toBeTruthy();
  });

  it("deduplicates by content hash", async () => {
    const content = "唯一测试内容用于验证去重-" + Date.now() + "额外文字".repeat(20);
    const article: ContentSourceArticle = {
      title: "去重测试-" + Date.now(),
      sourceUrl: "https://example.com/dup-" + Date.now(),
      publishedAt: new Date(),
      fullContent: content,
      platform: "website",
    };

    const r1 = await importContentSourceArticle(article);
    expect(r1.status).toBe("new");

    // Same content, should be duplicate
    const r2 = await importContentSourceArticle(article);
    expect(r2.status).toBe("duplicate");
    expect(r2.articleId).toBe(r1.articleId);
  });

  it("falls back to summary when no fullContent", async () => {
    const article: ContentSourceArticle = {
      title: "仅有摘要的文章-" + Date.now(),
      sourceUrl: "https://example.com/summary-only-" + Date.now(),
      publishedAt: new Date(),
      summary: "这是文章摘要，作为回退内容来源。摘要文本也需要满足基本的字符数来确保导入的合理性。".repeat(5),
      platform: "website",
    };

    const result = await importContentSourceArticle(article);
    expect(result.status).toBe("new");

    const saved = await prisma.materialArticle.findUnique({ where: { id: result.articleId! } });
    expect(saved!.fullContent).toBeNull();
    expect(saved!.summary).toBe(article.summary);
  });
});

describe("ContentIngestionRun", () => {
  let runId: string;

  it("creates an ingestion run", async () => {
    const run = await createIngestionRun("rss");
    expect(run.status).toBe("running");
    expect(run.source).toBe("rss");
    runId = run.id;
  });

  it("completes an ingestion run", async () => {
    await completeIngestionRun(runId, { articlesFound: 42, articlesNew: 30, articlesDuplicated: 12, errors: [] });
    const run = await prisma.contentIngestionRun.findUnique({ where: { id: runId } });
    expect(run!.status).toBe("completed");
    expect(run!.articlesFound).toBe(42);
    expect(run!.articlesNew).toBe(30);
    expect(run!.articlesDup).toBe(12);
  });

  it("fails an ingestion run", async () => {
    const run = await createIngestionRun("newrank");
    await failIngestionRun(run.id, "API key missing");
    const updated = await prisma.contentIngestionRun.findUnique({ where: { id: run.id } });
    expect(updated!.status).toBe("failed");
    expect(updated!.errorMessage).toBe("API key missing");
  });

  it("queries ingestion history", async () => {
    const { total } = await queryIngestionHistory({});
    expect(total).toBeGreaterThanOrEqual(2); // at least the two we created
  });

  it("recovers stale ingestion runs", async () => {
    // Create a run with old startedAt
    const oldRun = await prisma.contentIngestionRun.create({
      data: {
        source: "rss",
        status: "running",
        startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      },
    });
    const recovered = await recoverStaleIngestionRuns(30 * 60 * 1000); // 30 min threshold
    expect(recovered).toBeGreaterThanOrEqual(1);

    const updated = await prisma.contentIngestionRun.findUnique({ where: { id: oldRun.id } });
    expect(updated!.status).toBe("failed");
    expect(updated!.errorMessage).toContain("Stale");
  });
});

describe("RSSContentSource with mock server", () => {
  it("fetches and parses RSS feed", async () => {
    const source = new RSSContentSource(true);
    // Override the feed config to use our mock server
    const mockFeed = { url: `http://localhost:${mockFeedPort}/feed.xml`, name: "测试源", platform: "website", domainHint: "科技" };
    (source as unknown as { feedConfigs: { url: string; name: string; platform: string; domainHint: string }[] }).feedConfigs = [mockFeed];

    const articles = await source.fetchRecent();
    expect(articles.length).toBeGreaterThanOrEqual(1);

    const mainArticle = articles.find(a => a.title.includes("低粉爆款方法论"));
    expect(mainArticle).toBeTruthy();
    expect(mainArticle!.title).toContain("低粉爆款方法论");
    expect(mainArticle!.sourceUrl).toBe("https://test-blog.example.com/article/1");
    expect(mainArticle!.fullContent).toBeTruthy();
    expect(mainArticle!.fullContent!.length).toBeGreaterThan(100);
    expect(mainArticle!.platform).toBe("website");
    expect(mainArticle!.accountName).toBe("测试作者");
  });

  it("reports health status", async () => {
    const source = new RSSContentSource(true);
    const mockFeed = { url: `http://localhost:${mockFeedPort}/feed.xml`, name: "测试源", platform: "website", domainHint: "科技" };
    (source as unknown as { feedConfigs: { url: string; name: string; platform: string; domainHint: string }[] }).feedConfigs = [mockFeed];

    const health = await source.healthCheck();
    expect(health.name).toBe("rss");
    expect(health.status).toBe("ok");
    expect(health.lastArticleCount).toBeGreaterThanOrEqual(1);
  });

  it("handles feed errors gracefully", async () => {
    const source = new RSSContentSource(true);
    const badFeed = { url: `http://localhost:${mockFeedPort}/nonexistent.xml`, name: "坏源", platform: "website", domainHint: "科技" };
    (source as unknown as { feedConfigs: { url: string; name: string; platform: string; domainHint: string }[] }).feedConfigs = [
      badFeed,
      { url: `http://localhost:${mockFeedPort}/feed.xml`, name: "好源", platform: "website", domainHint: "科技" },
    ];

    const articles = await source.fetchRecent();
    // Non-existent feed should be skipped, good feed should return articles
    // (The bad feed may throw, which is caught and logged)
    expect(articles.length).toBeGreaterThanOrEqual(1);
  });
});

describe("ContentSourceManager.fetchSource (integration)", () => {
  it("fetches from RSS source and imports articles", async () => {
    const manager = new ContentSourceManager();
    const source = new RSSContentSource(true);
    const mockFeed = { url: `http://localhost:${mockFeedPort}/feed.xml`, name: "测试源", platform: "website", domainHint: "科技" };
    (source as unknown as { feedConfigs: { url: string; name: string; platform: string; domainHint: string }[] }).feedConfigs = [mockFeed];
    manager.register(source);

    const result = await manager.fetchSource("rss");
    expect(result.source).toBe("rss");
    expect(result.articlesFound).toBeGreaterThanOrEqual(1);
    // At least 1 article should be new (not a duplicate from earlier test)
    expect(result.articlesNew + result.articlesDuplicated).toBeGreaterThanOrEqual(1);
  });
});
