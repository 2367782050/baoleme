import { NextRequest } from "next/server";
import { queryArticleMaterials } from "@/lib/services/material.service";
import { ok } from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const query = {
    platform: params.get("platform") ?? undefined,
    domainId: params.get("domainId") ?? undefined,
    accountId: params.get("accountId") ?? undefined,
    keyword: params.get("keyword") ?? undefined,
    page: parseInt(params.get("page") ?? "1", 10),
    pageSize: parseInt(params.get("pageSize") ?? "20", 10),
  };

  const result = await queryArticleMaterials(query);

  return ok({
    items: result.items.map((a) => ({
      id: a.id,
      platform: a.platform,
      accountId: a.accountId,
      domainId: a.domainId,
      title: a.title,
      sourceUrl: a.sourceUrl,
      summary: a.summary,
      contentExcerpt: a.contentExcerpt,
      coverUrl: a.coverUrl,
      readCount: a.readCount,
      likeCount: a.likeCount,
      commentCount: a.commentCount,
      publishedAt: a.publishedAt,
      sourceProvider: a.sourceProvider,
    })),
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  });
}
