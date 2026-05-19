import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import type {
  MaterialProvider,
  DomainTree,
  PaginatedResult,
  AccountQuery,
  ArticleQuery,
  TopicQuery,
} from "./types";
import type {
  MaterialAccount,
  MaterialArticle,
  HotTopic,
} from "@/lib/generated/prisma/client";

export class SeedImportMaterialProvider implements MaterialProvider {
  async getDomainTree(): Promise<DomainTree[]> {
    const all = await prisma.materialDomain.findMany({
      orderBy: { sortOrder: "asc" },
    });

    const map = new Map<string, DomainTree>();
    const roots: DomainTree[] = [];

    for (const d of all) {
      map.set(d.id, { ...d, children: [] });
    }

    for (const d of all) {
      const node = map.get(d.id)!;
      if (d.parentId) {
        const parent = map.get(d.parentId);
        if (parent) parent.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  async queryAccounts(query: AccountQuery): Promise<PaginatedResult<MaterialAccount>> {
    const where: Prisma.MaterialAccountWhereInput = {};

    if (query.platform) where.platform = query.platform;
    if (query.domainId) where.domainId = query.domainId;
    if (query.keyword) {
      where.OR = [
        { name: { contains: query.keyword, mode: "insensitive" } },
      ];
    }

    const sortBy = query.sortBy ?? "rank";
    const sortOrder = query.sortOrder ?? "asc";
    const orderBy: Prisma.MaterialAccountOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [items, total] = await Promise.all([
      prisma.materialAccount.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { domain: true },
      }),
      prisma.materialAccount.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async queryArticles(query: ArticleQuery): Promise<PaginatedResult<MaterialArticle>> {
    const where: Prisma.MaterialArticleWhereInput = {};

    if (query.platform) where.platform = query.platform;
    if (query.domainId) where.domainId = query.domainId;
    if (query.accountId) where.accountId = query.accountId;
    if (query.keyword) {
      where.OR = [
        { title: { contains: query.keyword, mode: "insensitive" } },
        { summary: { contains: query.keyword, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.materialArticle.findMany({
        where,
        orderBy: { publishedAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { account: true, domain: true },
      }),
      prisma.materialArticle.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async queryHotTopics(query: TopicQuery): Promise<PaginatedResult<HotTopic>> {
    const where: Prisma.HotTopicWhereInput = {};
    if (query.platform) where.platform = query.platform;

    const [items, total] = await Promise.all([
      prisma.hotTopic.findMany({
        where,
        orderBy: { rank: "asc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.hotTopic.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize };
  }
}

export const materialProvider: MaterialProvider = new SeedImportMaterialProvider();
