import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { queryImportedArticles } from "@/lib/services/material-import.service";
import { ok, err, unauthorized } from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const p = req.nextUrl.searchParams;
    const { items, total } = await queryImportedArticles(session.userId, {
      domainId: p.get("domainId") ?? undefined,
      keyword: p.get("keyword") ?? undefined,
      page: parseInt(p.get("page") ?? "1"),
      pageSize: parseInt(p.get("pageSize") ?? "20"),
    });
    return ok({ items, total });
  } catch (e) {
    if (e instanceof Error && (e as { code?: string }).code === "UNAUTHORIZED") return unauthorized();
    return err("INTERNAL_ERROR", "查询失败", undefined, 500);
  }
}
