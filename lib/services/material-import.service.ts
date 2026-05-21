/**
 * Phase 23: Material article import service.
 * Supports paste, URL fetch, and third-party (stub).
 */

import { prisma } from "@/lib/db";
import { createHash } from "node:crypto";

function hashContent(content: string): string {
  return createHash("sha256").update(content.replace(/\s+/g, " ").trim()).digest("hex");
}

export class DuplicateMaterialError extends Error {
  constructor(message = "你已经导入过相同内容的文章") { super(message); this.name = "DuplicateMaterialError"; }
}

export type ImportPasteInput = {
  title: string;
  content: string;
  domainId: string;
  sourceUrl?: string;
  platform?: string;
  summary?: string;
};

export type ImportUrlInput = {
  url: string;
  domainId: string;
  title?: string;
  platform?: string;
};

export async function importFromPaste(userId: string, input: ImportPasteInput) {
  if (!input.title || input.title.length < 2 || input.title.length > 200) throw new Error("标题长度需在 2-200 字之间");
  if (!input.content || input.content.length < 30) throw new Error("内容太短，至少需要 30 字");

  const domain = await prisma.materialDomain.findUnique({ where: { id: input.domainId } });
  if (!domain) throw new Error("赛道不存在");

  const hash = hashContent(input.content);
  const existing = await prisma.materialArticle.findFirst({
    where: { importedByUserId: userId, contentHash: hash },
  });
  if (existing) throw new DuplicateMaterialError();

  return prisma.materialArticle.create({
    data: {
      platform: input.platform ?? "wechat",
      domainId: input.domainId,
      title: input.title,
      sourceUrl: input.sourceUrl,
      summary: input.summary ?? input.content.substring(0, 300),
      contentExcerpt: input.content.substring(0, 300),
      fullContent: input.content,
      contentHash: hash,
      contentLength: input.content.length,
      sourceProvider: "seed",
      importSource: "paste",
      importedByUserId: userId,
    },
  });
}

export async function importFromUrl(userId: string, input: ImportUrlInput) {
  if (!input.domainId) throw new Error("请选择赛道");
  const domain = await prisma.materialDomain.findUnique({ where: { id: input.domainId } });
  if (!domain) throw new Error("赛道不存在");

  let html: string;
  try {
    const res = await fetch(input.url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) throw new Error(`抓取失败: HTTP ${res.status}`);
    html = await res.text();
  } catch (e) {
    if ((e as Error).name === "TimeoutError") throw new Error("URL 抓取超时，请检查链接是否可访问");
    throw new Error(`URL 抓取失败: ${(e as Error).message}`);
  }

  // Basic text extraction
  const title = input.title ?? (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim()) ?? "未命名文章";
  const content = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (content.length < 50) throw new Error("无法提取到足够内容，请尝试粘贴全文");

  const hash = hashContent(content);
  const existing = await prisma.materialArticle.findFirst({
    where: { importedByUserId: userId, contentHash: hash },
  });
  if (existing) throw new DuplicateMaterialError();

  return prisma.materialArticle.create({
    data: {
      platform: input.platform ?? "wechat",
      domainId: input.domainId,
      title,
      sourceUrl: input.url,
      summary: content.substring(0, 300),
      contentExcerpt: content.substring(0, 300),
      fullContent: content,
      contentHash: hash,
      contentLength: content.length,
      sourceProvider: "seed",
      importSource: "url",
      importedByUserId: userId,
    },
  });
}

export function importFromThirdParty(): never {
  throw new Error("第三方数据接口暂未配置");
}

export async function queryImportedArticles(userId: string, params: { domainId?: string; keyword?: string; page?: number; pageSize?: number }) {
  const where: Record<string, unknown> = { importedByUserId: userId };
  if (params.domainId) where.domainId = params.domainId;
  if (params.keyword) where.title = { contains: params.keyword };
  const page = params.page ?? 1;
  const pageSize = Math.min(params.pageSize ?? 20, 50);

  const [items, total] = await Promise.all([
    prisma.materialArticle.findMany({
      where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize,
      include: { domain: { select: { name: true } } },
    }),
    prisma.materialArticle.count({ where }),
  ]);
  return { items, total };
}
