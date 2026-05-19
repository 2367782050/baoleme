import { NextRequest } from "next/server";
import { queryAccounts } from "@/lib/services/material.service";
import { ok } from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const query = {
    platform: params.get("platform") ?? undefined,
    domainId: params.get("domainId") ?? undefined,
    keyword: params.get("keyword") ?? undefined,
    sortBy: (params.get("sortBy") as "rank" | "avgTopReadCount" | undefined) ?? "rank",
    sortOrder: (params.get("sortOrder") as "asc" | "desc") ?? "asc",
    page: parseInt(params.get("page") ?? "1", 10),
    pageSize: parseInt(params.get("pageSize") ?? "20", 10),
  };

  const result = await queryAccounts(query);

  return ok({
    items: result.items.map((a) => ({
      id: a.id,
      platform: a.platform,
      name: a.name,
      avatarUrl: a.avatarUrl,
      externalId: a.externalId,
      domainId: a.domainId,
      domainName: (a as { domain?: { name: string } }).domain?.name ?? null,
      avgTopReadCount: a.avgTopReadCount,
      avgReadCount: a.avgReadCount,
      postCountDaily: a.postCountDaily,
      likeCountTotal: a.likeCountTotal,
      originalIndex: a.originalIndex,
      rank: a.rank,
      sourceProvider: a.sourceProvider,
      snapshotDate: a.snapshotDate,
      isFavorited: false,
    })),
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  });
}
