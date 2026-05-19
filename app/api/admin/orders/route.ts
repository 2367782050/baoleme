import { NextRequest } from "next/server";
import { requireAdmin, AdminForbiddenError } from "@/lib/auth/admin-guard";
import { listAllOrders } from "@/lib/services/admin.service";
import { ok, forbidden, unauthorized } from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  try { await requireAdmin(); const p = req.nextUrl.searchParams;
    const { items, total } = await listAllOrders({ status: p.get("status") ?? undefined, page: parseInt(p.get("page") ?? "1"), pageSize: parseInt(p.get("pageSize") ?? "20") });
    return ok({ items, total }); }
  catch (e) { if (e instanceof AdminForbiddenError) return forbidden(e.message); if (e instanceof Error && (e as { code?: string }).code === "UNAUTHORIZED") return unauthorized(); throw e; }
}
