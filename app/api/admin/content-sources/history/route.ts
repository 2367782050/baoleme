/**
 * Phase 24: Admin API — Content ingestion history.
 * GET /api/admin/content-sources/history
 */
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { ok, err } from "@/lib/utils/api-response";
import { queryIngestionHistory } from "@/lib/services/content-ingestion.service";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const source = url.searchParams.get("source") ?? undefined;
    const page = parseInt(url.searchParams.get("page") ?? "1", 10);
    const pageSize = parseInt(url.searchParams.get("pageSize") ?? "20", 10);

    const history = await queryIngestionHistory({ source, page, pageSize });
    return ok(history);
  } catch (e) {
    if ((e as { code?: string }).code === "UNAUTHORIZED") {
      return err("UNAUTHORIZED", "未登录或非管理员", undefined, 401);
    }
    return err("INTERNAL_ERROR", "获取摄入历史失败", undefined, 500);
  }
}
