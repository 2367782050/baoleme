import { prisma } from "@/lib/db";
import { materialProvider } from "@/lib/adapters/material";
import type {
  AccountQuery,
  ArticleQuery,
  TopicQuery,
  PaginatedResult,
  DomainTree,
} from "@/lib/adapters/material";
import type {
  MaterialAccount,
  MaterialArticle,
  HotTopic,
  Favorite,
} from "@/lib/generated/prisma/client";
import { assertCanUse, consume } from "./quota.service";

// ─── Domains ──────────────────────────────────────────────────────

export async function getDomainTree(): Promise<DomainTree[]> {
  return materialProvider.getDomainTree();
}

// ─── Accounts ─────────────────────────────────────────────────────

export async function queryAccounts(query: AccountQuery): Promise<PaginatedResult<MaterialAccount>> {
  return materialProvider.queryAccounts(query);
}

// ─── Articles ─────────────────────────────────────────────────────

export async function queryArticleMaterials(
  query: ArticleQuery,
): Promise<PaginatedResult<MaterialArticle>> {
  return materialProvider.queryArticles(query);
}

// ─── Hot Topics ───────────────────────────────────────────────────

export async function queryHotTopics(query: TopicQuery): Promise<PaginatedResult<HotTopic>> {
  return materialProvider.queryHotTopics(query);
}

// ─── Favorites ────────────────────────────────────────────────────

export type FavoriteTargetType = "account" | "article" | "topic" | "prompt";

export async function addFavorite(
  userId: string,
  targetType: FavoriteTargetType,
  targetId: string,
): Promise<Favorite> {
  // Check for duplicates
  const existing = await prisma.favorite.findFirst({
    where: { userId, targetType, targetId },
  });
  if (existing) {
    throw new DuplicateFavoriteError("已收藏，不可重复收藏");
  }

  return prisma.favorite.create({
    data: { userId, targetType, targetId },
  });
}

export async function removeFavorite(
  favoriteId: string,
  userId: string,
): Promise<void> {
  const fav = await prisma.favorite.findUnique({ where: { id: favoriteId } });
  if (!fav || fav.userId !== userId) {
    throw new FavoriteNotFoundError("收藏记录不存在");
  }
  await prisma.favorite.delete({ where: { id: favoriteId } });
}

export async function listFavorites(
  userId: string,
  targetType?: FavoriteTargetType,
): Promise<Favorite[]> {
  const where: { userId: string; targetType?: string } = { userId };
  if (targetType) where.targetType = targetType;
  return prisma.favorite.findMany({ where, orderBy: { createdAt: "desc" } });
}

export async function isFavorited(
  userId: string,
  targetType: FavoriteTargetType,
  targetId: string,
): Promise<boolean> {
  const fav = await prisma.favorite.findFirst({
    where: { userId, targetType, targetId },
  });
  return fav !== null;
}

// ─── Export ───────────────────────────────────────────────────────

export async function exportMaterial(
  userId: string,
  type: "accounts" | "articles" | "topics",
  filters: Record<string, string> = {},
): Promise<string> {
  // Check quota
  await assertCanUse(userId, "material_export");

  let csv = "";

  if (type === "accounts") {
    const result = await materialProvider.queryAccounts({
      page: 1,
      pageSize: 10000,
      platform: filters.platform,
      domainId: filters.domainId,
      keyword: filters.keyword,
    });
    csv =
      "排名,平台,账号名称,行业,头条平均阅读,平均阅读,日发文数,总点赞数,原创指数\n";
    for (const a of result.items) {
      const domain = (a as MaterialAccount & { domain?: { name: string } }).domain;
      csv += `${a.rank},${a.platform},${a.name},${domain?.name ?? ""},${a.avgTopReadCount},${a.avgReadCount},${a.postCountDaily},${a.likeCountTotal},${a.originalIndex}\n`;
    }
  } else if (type === "articles") {
    const result = await materialProvider.queryArticles({
      page: 1,
      pageSize: 10000,
      platform: filters.platform,
      domainId: filters.domainId,
      keyword: filters.keyword,
    });
    csv = "平台,标题,阅读数,点赞数,评论数,发布时间,来源链接\n";
    for (const a of result.items) {
      csv += `${a.platform},"${a.title}",${a.readCount},${a.likeCount},${a.commentCount},${a.publishedAt ?? ""},${a.sourceUrl ?? ""}\n`;
    }
  } else if (type === "topics") {
    const result = await materialProvider.queryHotTopics({
      page: 1,
      pageSize: 10000,
      platform: filters.platform,
    });
    csv = "排名,平台,标题,热度,链接\n";
    for (const t of result.items) {
      csv += `${t.rank},${t.platform},"${t.title}",${t.heatScore},${t.url ?? ""}\n`;
    }
  }

  // Consume quota after successful export
  await consume(userId, "material_export", 1);

  return csv;
}

// ─── Import ───────────────────────────────────────────────────────

export type ImportResult = {
  imported: number;
  errors: { row: number; message: string }[];
};

export async function importMaterialAccounts(
  data: Array<{
    platform: string;
    name: string;
    externalId?: string;
    avatarUrl?: string;
    domainId?: string;
    avgTopReadCount?: number;
    avgReadCount?: number;
    postCountDaily?: number;
    likeCountTotal?: number;
    originalIndex?: number;
    rank?: number;
    snapshotDate?: string;
  }>,
): Promise<ImportResult> {
  const errors: { row: number; message: string }[] = [];
  let imported = 0;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    try {
      if (!row.platform || !row.name) {
        errors.push({ row: i + 1, message: "平台和账号名称为必填字段" });
        continue;
      }

      const validPlatforms = ["wechat", "xiaohongshu", "douyin", "toutiao"];
      if (!validPlatforms.includes(row.platform)) {
        errors.push({ row: i + 1, message: `平台 ${row.platform} 无效` });
        continue;
      }

      // Dedup by platform + name + sourceProvider
      const existing = await prisma.materialAccount.findFirst({
        where: {
          platform: row.platform,
          name: row.name,
          sourceProvider: "import",
        },
      });
      if (existing) {
        errors.push({ row: i + 1, message: `账号 ${row.name} 已存在` });
        continue;
      }

      await prisma.materialAccount.create({
        data: {
          platform: row.platform,
          name: row.name,
          externalId: row.externalId ?? null,
          avatarUrl: row.avatarUrl ?? null,
          domainId: row.domainId ?? null,
          avgTopReadCount: row.avgTopReadCount ?? 0,
          avgReadCount: row.avgReadCount ?? 0,
          postCountDaily: row.postCountDaily ?? 0,
          likeCountTotal: row.likeCountTotal ?? 0,
          originalIndex: row.originalIndex ?? 0,
          rank: row.rank ?? 0,
          sourceProvider: "import",
          snapshotDate: row.snapshotDate ? new Date(row.snapshotDate) : new Date(),
        },
      });
      imported++;
    } catch (e) {
      errors.push({ row: i + 1, message: `导入失败: ${(e as Error).message}` });
    }
  }

  return { imported, errors };
}

// ─── Error classes ────────────────────────────────────────────────

export class DuplicateFavoriteError extends Error {
  code = "DUPLICATE_FAVORITE";

  constructor(message: string) {
    super(message);
    this.name = "DuplicateFavoriteError";
  }
}

export class FavoriteNotFoundError extends Error {
  code = "NOT_FOUND";

  constructor(message: string) {
    super(message);
    this.name = "FavoriteNotFoundError";
  }
}
