/**
 * Phase 24: Content ingestion service.
 * Imports articles from ContentSource into the database.
 * Handles dedup, domain resolution, and account upsert.
 */
import { prisma } from "@/lib/db";
import { createHash } from "node:crypto";
import type { ContentSourceArticle } from "@/lib/adapters/material/sources/types";
import type { ContentIngestionRun, Prisma } from "@/lib/generated/prisma/client";

function hashContent(content: string): string {
  return createHash("sha256").update(content.replace(/\s+/g, " ").trim()).digest("hex");
}

export async function importContentSourceArticle(
  article: ContentSourceArticle,
): Promise<{ status: "new" | "duplicate"; articleId?: string }> {
  const contentForHash = article.fullContent ?? article.summary ?? article.title;
  const hash = hashContent(contentForHash);

  // Dedup check via contentHash (global, not per-user)
  const existing = await prisma.materialArticle.findFirst({
    where: { contentHash: hash },
    select: { id: true },
  });
  if (existing) {
    return { status: "duplicate", articleId: existing.id };
  }

  // Resolve domain from domainHint
  let domainId: string | undefined;
  if (article.domainHint) {
    const domain = await prisma.materialDomain.findFirst({
      where: { name: { contains: article.domainHint, mode: "insensitive" } },
      select: { id: true, name: true },
    });
    domainId = domain?.id;
  }

  // Upsert account if accountName is provided
  let accountId: string | undefined;
  if (article.accountName) {
    const account = await prisma.materialAccount.upsert({
      where: {
        platform_name_sourceProvider: {
          platform: article.platform,
          name: article.accountName,
          sourceProvider: "rss",
        },
      },
      update: {},
      create: {
        platform: article.platform,
        name: article.accountName,
        externalId: article.accountExternalId,
        domainId,
        sourceProvider: "rss",
        snapshotDate: new Date(),
      },
    });
    accountId = account.id;
  }

  // Build content excerpt (first 300 chars of content or summary)
  const contentExcerpt = (article.summary ?? article.fullContent ?? "").substring(0, 300);

  const created = await prisma.materialArticle.create({
    data: {
      platform: article.platform,
      title: article.title,
      sourceUrl: article.sourceUrl,
      summary: article.summary,
      fullContent: article.fullContent,
      contentExcerpt,
      contentHash: hash,
      contentLength: (article.fullContent ?? article.summary ?? "").length,
      readCount: article.readCount ?? 0,
      likeCount: article.likeCount ?? 0,
      commentCount: article.commentCount ?? 0,
      publishedAt: article.publishedAt,
      sourceProvider: "rss",
      importSource: "auto",
      domainId,
      accountId,
    },
  });

  return { status: "new", articleId: created.id };
}

export async function createIngestionRun(
  source: string,
): Promise<ContentIngestionRun> {
  return prisma.contentIngestionRun.create({
    data: {
      source,
      status: "running",
      startedAt: new Date(),
    },
  });
}

export async function completeIngestionRun(
  runId: string,
  result: { articlesFound: number; articlesNew: number; articlesDuplicated: number; errors: string[] },
): Promise<void> {
  await prisma.contentIngestionRun.update({
    where: { id: runId },
    data: {
      status: "completed",
      articlesFound: result.articlesFound,
      articlesNew: result.articlesNew,
      articlesDup: result.articlesDuplicated,
      completedAt: new Date(),
    },
  });
}

export async function failIngestionRun(
  runId: string,
  errorMessage: string,
): Promise<void> {
  await prisma.contentIngestionRun.update({
    where: { id: runId },
    data: {
      status: "failed",
      errorMessage,
      completedAt: new Date(),
    },
  });
}

export async function queryIngestionHistory(params: {
  source?: string;
  page?: number;
  pageSize?: number;
}) {
  const where: Prisma.ContentIngestionRunWhereInput = {};
  if (params.source) where.source = params.source;

  const page = params.page ?? 1;
  const pageSize = Math.min(params.pageSize ?? 20, 50);

  const [items, total] = await Promise.all([
    prisma.contentIngestionRun.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.contentIngestionRun.count({ where }),
  ]);

  return { items, total };
}

export async function recoverStaleIngestionRuns(
  staleMs: number = 30 * 60 * 1000, // 30 min default
): Promise<number> {
  const stale = await prisma.contentIngestionRun.findMany({
    where: {
      status: "running",
      startedAt: { lt: new Date(Date.now() - staleMs) },
    },
    select: { id: true },
  });

  if (stale.length > 0) {
    await prisma.contentIngestionRun.updateMany({
      where: { id: { in: stale.map(s => s.id) } },
      data: {
        status: "failed",
        errorMessage: "Stale run — auto-recovered",
        completedAt: new Date(),
      },
    });
  }

  return stale.length;
}
