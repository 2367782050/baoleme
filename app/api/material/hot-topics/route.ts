import { NextRequest } from "next/server";
import { queryHotTopics } from "@/lib/services/material.service";
import { ok } from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const query = {
    platform: params.get("platform") ?? undefined,
    page: parseInt(params.get("page") ?? "1", 10),
    pageSize: parseInt(params.get("pageSize") ?? "20", 10),
  };

  const result = await queryHotTopics(query);

  return ok({
    items: result.items.map((t) => ({
      id: t.id,
      platform: t.platform,
      title: t.title,
      url: t.url,
      rank: t.rank,
      heatScore: t.heatScore,
      snapshotAt: t.snapshotAt,
    })),
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  });
}
