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

export class ValidationError extends Error {
  constructor(message: string) { super(message); this.name = "ValidationError"; }
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
  if (!input.title || input.title.length < 2 || input.title.length > 200) throw new ValidationError("标题长度需在 2-200 字之间");
  if (!input.content || input.content.length < 300) throw new ValidationError("正文内容太少，至少需要 300 字");

  const domain = await prisma.materialDomain.findUnique({ where: { id: input.domainId } });
  if (!domain) throw new ValidationError("赛道不存在");

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
      // AI suggested domain: use user-selected domain as baseline
      aiSuggestedDomainId: domain.id,
      aiSuggestedDomainName: domain.name,
      aiSuggestedDomainConfidence: 0.8,
    },
  });
}

function extractContent(html: string): string {
  // Step 1: Try to find main content area
  let target = html;

  // Try article/main tag first, then common content divs
  const contentSelectors = [
    /<article[^>]*>([\s\S]*?)<\/article>/gi,
    /<main[^>]*>([\s\S]*?)<\/main>/gi,
    /<div[^>]*\b(?:class|id)="[^"]*(?:content|article|post|entry|detail|text|body)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<section[^>]*\b(?:class|id)="[^"]*(?:content|article|post|entry)[^"]*"[^>]*>([\s\S]*?)<\/section>/gi,
  ];

  for (const selector of contentSelectors) {
    const matches = [...target.matchAll(selector)];
    if (matches.length > 0) {
      // Use the longest match (most likely the main content)
      const best = matches.reduce((a, b) =>
        (b[1]?.length ?? 0) > (a[1]?.length ?? 0) ? b : a,
      );
      if (best[1] && best[1].length > 200) {
        target = best[1];
        break;
      }
    }
  }

  // Step 2: Remove unwanted elements
  target = target
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, "")
    .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, "")
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, "")
    .replace(/<form[^>]*>[\s\S]*?<\/form>/gi, "")
    // Remove common non-content elements
    .replace(/<[^>]*\b(?:class|id)="[^"]*(?:comment|sidebar|footer|header|nav|menu|ad|advert|share|related|recommend|sidebar|widget|author-box|breadcrumb|pagination|popup|modal|banner)[^"]*"[^>]*>[\s\S]*?<\/[^>]+>/gi, "")
    // Remove HTML comments
    .replace(/<!--[\s\S]*?-->/g, "");

  // Step 3: Convert block elements to newlines for natural paragraph separation
  target = target
    .replace(/<\/(?:p|div|h[1-6]|li|tr|article|section|blockquote|pre|figure|figcaption|br|hr)[^>]*>/gi, "\n")
    .replace(/<br[^>]*\/?>/gi, "\n")
    .replace(/<p[^>]*>/gi, "\n")
    .replace(/<(?:h[1-6]|li|div|tr)[^>]*>/gi, "\n");

  // Step 4: Strip remaining HTML tags
  target = target.replace(/<[^>]+>/g, "");

  // Step 5: Decode HTML entities
  target = target
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));

  // Step 6: Normalize whitespace while preserving paragraph breaks
  target = target
    .split("\n")
    .map(line => line.replace(/\s+/g, " ").trim())
    .filter(line => line.length > 0)
    .join("\n\n");

  return target.trim();
}

export async function importFromUrl(userId: string, input: ImportUrlInput) {
  // Step 1: Fetch the target URL
  let html: string;
  try {
    const res = await fetch(input.url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Baoleme/1.0)",
        "Accept": "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new ValidationError(`无法访问目标链接 (HTTP ${res.status})`);
    const contentType = res.headers?.get?.("content-type") ?? "";
    if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      throw new ValidationError("目标链接不是 HTML 页面，无法提取正文");
    }
    html = await res.text();
  } catch (e) {
    if (e instanceof ValidationError) throw e;
    throw new ValidationError("无法访问目标链接，请检查 URL 是否可公开访问");
  }

  // Step 2: Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  let title = input.title ?? titleMatch?.[1]?.trim() ?? "";
  // Clean common title suffixes
  title = title.replace(/\s*[-–|_]\s*.+$/, "").trim();
  if (!title || title.length < 2) throw new ValidationError("无法提取文章标题，请手动输入");

  // Step 3: Extract main content using smart extraction
  const content = extractContent(html);
  if (content.length < 300) {
    throw new ValidationError(
      `无法提取到足够内容（当前仅提取到 ${content.length} 字，需至少 300 字），请尝试粘贴全文`
    );
  }

  // Step 4: Validate domain
  const domain = await prisma.materialDomain.findUnique({ where: { id: input.domainId } });
  if (!domain) throw new ValidationError("赛道不存在");

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
      aiSuggestedDomainId: domain.id,
      aiSuggestedDomainName: domain.name,
      aiSuggestedDomainConfidence: 0.8,
    },
  });
}

export function importFromThirdParty(): never {
  throw new ValidationError("第三方数据接口暂未配置");
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
