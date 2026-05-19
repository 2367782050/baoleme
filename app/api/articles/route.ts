import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listArticles } from "@/lib/services/article.service";
import { ok, err, unauthorized } from "@/lib/utils/api-response";

function ua(e: unknown) {
  if (e instanceof Error && (e as { code?: string }).code === "UNAUTHORIZED") return unauthorized();
  return null;
}

export async function GET(req: NextRequest) {
  try { const s = await requireAuth(); const p = req.nextUrl.searchParams;
    const r = await listArticles({ userId: s.userId, groupId: p.get("groupId") ?? undefined,
      status: p.get("status") ?? undefined, pushStatus: p.get("pushStatus") ?? undefined,
      keyword: p.get("keyword") ?? undefined,
      page: parseInt(p.get("page") ?? "1"), pageSize: parseInt(p.get("pageSize") ?? "20") });
    return ok({ items: r.items, total: r.total, page: parseInt(p.get("page") ?? "1"), pageSize: parseInt(p.get("pageSize") ?? "20") });
  } catch (e) { return ua(e) ?? err("INTERNAL_ERROR", "服务器内部错误", undefined, 500); }
}
