import { prisma } from "@/lib/db";
import type { Prisma, ArticleGroup, Article } from "@/lib/generated/prisma/client";

export async function createArticleGroup(userId: string, name: string, description?: string): Promise<ArticleGroup> {
  return prisma.articleGroup.create({
    data: { userId, name, description: description ?? null },
  });
}

export async function listArticleGroups(userId: string): Promise<ArticleGroup[]> {
  return prisma.articleGroup.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
}

export async function updateArticleGroup(
  groupId: string, userId: string, data: { name?: string; description?: string },
): Promise<ArticleGroup> {
  const g = await prisma.articleGroup.findUnique({ where: { id: groupId } });
  if (!g || g.userId !== userId) throw new ArticleGroupNotFoundError("分组不存在");
  return prisma.articleGroup.update({ where: { id: groupId }, data });
}

export async function deleteArticleGroup(groupId: string, userId: string): Promise<void> {
  const g = await prisma.articleGroup.findUnique({ where: { id: groupId } });
  if (!g || g.userId !== userId) throw new ArticleGroupNotFoundError("分组不存在");
  const count = await prisma.article.count({ where: { groupId } });
  if (count > 0) throw new ArticleGroupNotEmptyError("分组不为空，请先删除或移出分组内的文章");
  await prisma.articleGroup.delete({ where: { id: groupId } });
}

export class ArticleGroupNotFoundError extends Error { code = "NOT_FOUND"; constructor(m: string) { super(m); this.name = "ArticleGroupNotFoundError"; } }
export class ArticleGroupNotEmptyError extends Error { code = "GROUP_NOT_EMPTY"; constructor(m: string) { super(m); this.name = "ArticleGroupNotEmptyError"; } }

// ─── Article CRUD ───────────────────────────────────────────────

export type ArticleListQuery = {
  userId: string;
  groupId?: string;
  status?: string;
  pushStatus?: string;
  keyword?: string;
  page: number;
  pageSize: number;
};

export async function listArticles(query: ArticleListQuery): Promise<{ items: Article[]; total: number }> {
  const where: Prisma.ArticleWhereInput = { userId: query.userId };
  if (query.groupId) where.groupId = query.groupId;
  if (query.status) where.status = query.status;
  if (query.pushStatus) where.pushStatus = query.pushStatus;
  if (query.keyword) {
    where.OR = [
      { title: { contains: query.keyword, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.article.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { group: true, prompt: true },
    }),
    prisma.article.count({ where }),
  ]);
  return { items, total };
}

export async function getArticle(articleId: string, userId: string): Promise<Article | null> {
  const a = await prisma.article.findUnique({ where: { id: articleId }, include: { group: true, prompt: true } });
  if (!a || a.userId !== userId) return null;
  return a;
}

export async function updateArticle(
  articleId: string, userId: string,
  data: { title?: string; markdownContent?: string; htmlContent?: string; coverUrl?: string; groupId?: string | null; formatterConfig?: Record<string, unknown> },
): Promise<Article> {
  const a = await prisma.article.findUnique({ where: { id: articleId } });
  if (!a || a.userId !== userId) throw new ArticleNotFoundError("文章不存在");
  if (data.groupId) {
    const g = await prisma.articleGroup.findUnique({ where: { id: data.groupId } });
    if (!g || g.userId !== userId) throw new ArticleGroupNotFoundError("分组不存在");
  }
  const updateData: Prisma.ArticleUpdateInput = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.markdownContent !== undefined) updateData.markdownContent = data.markdownContent;
  if (data.htmlContent !== undefined) updateData.htmlContent = data.htmlContent;
  if (data.coverUrl !== undefined) updateData.coverUrl = data.coverUrl;
  if (data.groupId !== undefined) updateData.group = data.groupId ? { connect: { id: data.groupId } } : { disconnect: true };
  if (data.formatterConfig !== undefined) updateData.formatterConfig = data.formatterConfig as Prisma.InputJsonValue;
  return prisma.article.update({ where: { id: articleId }, data: updateData });
}

export async function deleteArticle(articleId: string, userId: string): Promise<void> {
  const a = await prisma.article.findUnique({ where: { id: articleId } });
  if (!a || a.userId !== userId) throw new ArticleNotFoundError("文章不存在");
  // Delete related generation jobs first
  await prisma.articleGenerationJob.deleteMany({ where: { articleId } });
  await prisma.article.delete({ where: { id: articleId } });
}

export class ArticleNotFoundError extends Error { code = "NOT_FOUND"; constructor(m: string) { super(m); this.name = "ArticleNotFoundError"; } }
