import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../lib/db/prisma.js";
import { registerUser } from "../lib/services/auth.service.js";
import { createGroup } from "../lib/services/prompt.service.js";
import {
  createArticleGroup, listArticleGroups, updateArticleGroup, deleteArticleGroup,
  ArticleGroupNotFoundError, ArticleGroupNotEmptyError,
  listArticles, getArticle, updateArticle, deleteArticle, ArticleNotFoundError,
} from "../lib/services/article.service.js";
import {
  createArticleGenerationJob, getArticleGenerationJob,
  executeArticleGenerationJob, retryArticleGenerationJob,
} from "../lib/services/article-generation.service.js";
import { mockAIProvider } from "../lib/adapters/ai/mock-provider.js";
import { QuotaExceededError } from "../lib/services/quota.service.js";

/** Reset daily quota for the user to allow generating articles in tests */
async function resetDailyQuota(userId: string, used = 0) {
  const pk = new Date().toISOString().substring(0, 10);
  await prisma.quotaUsage.upsert({
    where: { userId_capability_periodType_periodKey: { userId, capability: "article_generate", periodType: "daily", periodKey: pk } },
    create: { userId, capability: "article_generate", periodType: "daily", periodKey: pk, used },
    update: { used },
  });
}

describe("Article groups CRUD", () => {
  const u1 = `ag_${Date.now().toString(36)}`, u2 = `ag2_${Date.now().toString(36)}`;
  let userId: string, userId2: string;
  beforeAll(async () => {
    userId = (await registerUser({ username: u1, email: `ag_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) })).user.id;
    userId2 = (await registerUser({ username: u2, email: `ag2_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) })).user.id;
  });
  afterAll(async () => { await prisma.articleGenerationJob.deleteMany({ where: { userId: { in: [userId, userId2] } } }); await prisma.article.deleteMany({ where: { userId: { in: [userId, userId2] } } }); await prisma.articleGroup.deleteMany({ where: { userId: { in: [userId, userId2] } } }); await prisma.quotaUsage.deleteMany({ where: { userId: { in: [userId, userId2] } } }); await prisma.userMembership.deleteMany({ where: { userId: { in: [userId, userId2] } } }); await prisma.user.deleteMany({ where: { id: { in: [userId, userId2] } } }); });
  it("creates", async () => { const g = await createArticleGroup(userId, "测试分组"); expect(g.name).toBe("测试分组"); });
  it("lists own", async () => { await createArticleGroup(userId2, "别人的"); const l = await listArticleGroups(userId); expect(l.every(g => g.userId === userId)).toBe(true); });
  it("updates own", async () => { const g = await createArticleGroup(userId, "旧名"); expect((await updateArticleGroup(g.id, userId, { name: "新名" })).name).toBe("新名"); });
  it("cannot update other's", async () => { const g = await createArticleGroup(userId2, "别人的2"); await expect(updateArticleGroup(g.id, userId, { name: "x" })).rejects.toThrow(ArticleGroupNotFoundError); });
  it("deletes empty", async () => { const g = await createArticleGroup(userId, "待删"); await deleteArticleGroup(g.id, userId); expect((await listArticleGroups(userId)).find(x => x.id === g.id)).toBeUndefined(); });
  it("cannot delete non-empty", async () => { const g = await createArticleGroup(userId, "有内容"); await prisma.article.create({ data: { userId, groupId: g.id, status: "draft" } }); await expect(deleteArticleGroup(g.id, userId)).rejects.toThrow(ArticleGroupNotEmptyError); });
});

describe("Article CRUD", () => {
  const u1 = `ar_${Date.now().toString(36)}`, u2 = `ar2_${Date.now().toString(36)}`;
  let userId: string, userId2: string, gId: string, aId: string;
  beforeAll(async () => {
    userId = (await registerUser({ username: u1, email: `ar_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) })).user.id;
    userId2 = (await registerUser({ username: u2, email: `ar2_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) })).user.id;
    gId = (await createArticleGroup(userId, "分组")).id;
    aId = (await prisma.article.create({ data: { userId, groupId: gId, title: "我的文章", status: "draft" } })).id;
    await prisma.article.create({ data: { userId: userId2, title: "别人的", status: "draft" } });
  });
  afterAll(async () => { await prisma.articleGenerationJob.deleteMany({ where: { userId: { in: [userId, userId2] } } }); await prisma.article.deleteMany({ where: { userId: { in: [userId, userId2] } } }); await prisma.articleGroup.deleteMany({ where: { userId: { in: [userId, userId2] } } }); await prisma.quotaUsage.deleteMany({ where: { userId: { in: [userId, userId2] } } }); await prisma.userMembership.deleteMany({ where: { userId: { in: [userId, userId2] } } }); await prisma.user.deleteMany({ where: { id: { in: [userId, userId2] } } }); });
  it("lists own", async () => { const r = await listArticles({ userId, page: 1, pageSize: 10 }); expect(r.items.every(a => a.userId === userId)).toBe(true); expect(r.total).toBeGreaterThanOrEqual(1); });
  it("filters by groupId", async () => { const r = await listArticles({ userId, groupId: gId, page: 1, pageSize: 10 }); expect(r.items.every(a => a.groupId === gId)).toBe(true); });
  it("cannot get other's article", async () => { const other = (await listArticles({ userId: userId2, page: 1, pageSize: 1 })).items[0]; expect(await getArticle(other.id, userId)).toBeNull(); });
  it("gets own", async () => { expect(await getArticle(aId, userId)).not.toBeNull(); });
  it("updates own", async () => { expect((await updateArticle(aId, userId, { title: "更新了" })).title).toBe("更新了"); });
  it("cannot update other's", async () => { const other = (await listArticles({ userId: userId2, page: 1, pageSize: 1 })).items[0]; await expect(updateArticle(other.id, userId, { title: "x" })).rejects.toThrow(ArticleNotFoundError); });
  it("deletes article and related jobs", async () => {
    const a = await prisma.article.create({ data: { userId, title: "待删", status: "draft" } });
    await prisma.articleGenerationJob.create({ data: { userId, articleId: a.id, status: "pending", input: {} } });
    await deleteArticle(a.id, userId);
    expect(await prisma.article.findUnique({ where: { id: a.id } })).toBeNull();
    expect(await prisma.articleGenerationJob.count({ where: { articleId: a.id } })).toBe(0);
  });
  it("cannot delete other's", async () => { const other = (await listArticles({ userId: userId2, page: 1, pageSize: 1 })).items[0]; await expect(deleteArticle(other.id, userId)).rejects.toThrow(ArticleNotFoundError); });
});

describe("Article generation service", () => {
  const u = `gen_${Date.now().toString(36)}`;
  let userId: string; let promptId: string;
  beforeAll(async () => {
    const r = await registerUser({ username: u, email: `gen_${Date.now().toString(36)}@t.com`, password: "x".repeat(8) }); userId = r.user.id;
    const g = await createGroup(userId, "提示词组");
    const p = await prisma.prompt.create({ data: { userId, name: "测试提示词", content: "写一篇关于AI的文章", groupId: g.id, sourceType: "manual" } });
    promptId = p.id;
  });
  afterAll(async () => { await prisma.articleGenerationJob.deleteMany({ where: { userId } }); await prisma.article.deleteMany({ where: { userId } }); await prisma.prompt.deleteMany({ where: { userId } }); await prisma.promptGroup.deleteMany({ where: { userId } }); await prisma.articleGroup.deleteMany({ where: { userId } }); await prisma.quotaUsage.deleteMany({ where: { userId } }); await prisma.userMembership.deleteMany({ where: { userId } }); await prisma.user.delete({ where: { id: userId } }).catch(() => {}); });

  it("creates job with articleId + jobId + pending", async () => { const { article, job } = await createArticleGenerationJob(userId, { title: "AI的未来", promptId }); expect(article.id).toBeTruthy(); expect(job.id).toBeTruthy(); expect(job.status).toBe("pending"); expect(article.status).toBe("generating"); });

  it("executes → completed with markdown", async () => { await resetDailyQuota(userId); const { article, job } = await createArticleGenerationJob(userId, { title: "测试文章生成", promptId }); await prisma.articleGenerationJob.update({ where: { id: job.id }, data: { status: "running", startedAt: new Date(), attempts: { increment: 1 } } });
    await executeArticleGenerationJob(job.id); const j = await getArticleGenerationJob(job.id, userId); expect(j!.status).toBe("completed"); const a = await prisma.article.findUnique({ where: { id: article.id } }); expect(a!.status).toBe("completed"); expect(a!.markdownContent).toContain("#"); });

  it("mock review passes without rewrite", async () => { await resetDailyQuota(userId); const { article, job } = await createArticleGenerationJob(userId, { title: "通过审核", promptId }); await prisma.articleGenerationJob.update({ where: { id: job.id }, data: { status: "running", startedAt: new Date(), attempts: { increment: 1 } } });
    await executeArticleGenerationJob(job.id); const a = await prisma.article.findUnique({ where: { id: article.id } }); expect(a!.markdownContent).not.toContain("【精修】"); });

  it("mock review forces rewrite", async () => { mockAIProvider.setForceRewrite(true); await resetDailyQuota(userId); const { article, job } = await createArticleGenerationJob(userId, { title: "需要重写", promptId }); await prisma.articleGenerationJob.update({ where: { id: job.id }, data: { status: "running", startedAt: new Date(), attempts: { increment: 1 } } });
    await executeArticleGenerationJob(job.id); const a = await prisma.article.findUnique({ where: { id: article.id } }); expect(a!.markdownContent).toContain("【精修】"); });

  it("mock failure → failed with errorMessage", async () => { mockAIProvider.setFailNext(true); await resetDailyQuota(userId); const { article, job } = await createArticleGenerationJob(userId, { title: "会失败", promptId }); try { await prisma.articleGenerationJob.update({ where: { id: job.id }, data: { status: "running", startedAt: new Date(), attempts: { increment: 1 } } });
    await executeArticleGenerationJob(job.id); } catch {} const j = await getArticleGenerationJob(job.id, userId); expect(j!.status).toBe("failed"); expect(j!.errorMessage).toContain("Mock AI failure"); const a = await prisma.article.findUnique({ where: { id: article.id } }); expect(a!.status).toBe("failed"); });

  it("retry failed→pending→completed", async () => { mockAIProvider.setFailNext(true); await resetDailyQuota(userId); const { article, job } = await createArticleGenerationJob(userId, { title: "重试测试", promptId }); try { await prisma.articleGenerationJob.update({ where: { id: job.id }, data: { status: "running", startedAt: new Date(), attempts: { increment: 1 } } });
    await executeArticleGenerationJob(job.id); } catch {} const r = await retryArticleGenerationJob(job.id, userId); expect(r.status).toBe("pending"); await resetDailyQuota(userId); await prisma.articleGenerationJob.update({ where: { id: r.id }, data: { status: "running", startedAt: new Date(), attempts: { increment: 1 } } }); await executeArticleGenerationJob(r.id); const j2 = await getArticleGenerationJob(r.id, userId); expect(j2!.status).toBe("completed"); const a = await prisma.article.findUnique({ where: { id: article.id } }); expect(a!.status).toBe("completed"); });

  it("deducts article_generate quota on success", async () => { await resetDailyQuota(userId); const { job } = await createArticleGenerationJob(userId, { title: "配额测试", promptId }); await prisma.articleGenerationJob.update({ where: { id: job.id }, data: { status: "running", startedAt: new Date(), attempts: { increment: 1 } } });
    await executeArticleGenerationJob(job.id); const after = await prisma.quotaUsage.findFirst({ where: { userId, capability: "article_generate" } }); expect(after!.used).toBeGreaterThanOrEqual(1); });

  it("quota exceeded → QUOTA_EXCEEDED and no job/article created", async () => {
    await resetDailyQuota(userId, 1);
    const jobsBefore = await prisma.articleGenerationJob.count({ where: { userId } });
    const articlesBefore = await prisma.article.count({ where: { userId } });
    await expect(createArticleGenerationJob(userId, { title: "超限测试" })).rejects.toThrow(QuotaExceededError);
    expect(await prisma.articleGenerationJob.count({ where: { userId } })).toBe(jobsBefore);
    expect(await prisma.article.count({ where: { userId } })).toBe(articlesBefore);
  });
});
