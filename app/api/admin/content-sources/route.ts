/**
 * Phase 24: Admin API — Content source management.
 * GET  /api/admin/content-sources        → source statuses
 * POST /api/admin/content-sources/trigger → manual fetch
 */
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { ok, err } from "@/lib/utils/api-response";
import { getManager } from "@/lib/adapters/material/sources/manager-singleton";
import { queryIngestionHistory } from "@/lib/services/content-ingestion.service";

export async function GET() {
  try {
    await requireAdmin();
    const manager = getManager();
    const health = await manager.getHealth();
    const recentRuns = await queryIngestionHistory({ pageSize: 10 });

    return ok({
      sources: manager.listSources().map(s => ({
        name: s.name,
        description: s.description,
        enabled: s.isEnabled,
      })),
      health,
      recentRuns: recentRuns.items,
    });
  } catch (e) {
    if ((e as { code?: string }).code === "UNAUTHORIZED") {
      return err("UNAUTHORIZED", "未登录或非管理员", undefined, 401);
    }
    return err("INTERNAL_ERROR", "获取内容源状态失败", undefined, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const source = body.source as string;

    if (!source) {
      return err("VALIDATION_ERROR", "请指定 source 参数", undefined, 400);
    }

    const manager = getManager();
    const result = await manager.fetchSource(source);

    return ok(result);
  } catch (e) {
    if ((e as { code?: string }).code === "UNAUTHORIZED") {
      return err("UNAUTHORIZED", "未登录或非管理员", undefined, 401);
    }
    return err("INTERNAL_ERROR", `手动获取失败: ${(e as Error).message}`, undefined, 500);
  }
}
