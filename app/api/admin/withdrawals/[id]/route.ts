import { NextRequest } from "next/server";
import { requireAdmin, AdminForbiddenError } from "@/lib/auth/admin-guard";
import { reviewWithdrawal } from "@/lib/services/admin.service";
import { ok, err, forbidden, unauthorized } from "@/lib/utils/api-response";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const { userId: adminId } = await requireAdmin(); const { id } = await params; const { action } = await req.json();
    if (action !== "approved" && action !== "rejected") return err("VALIDATION_ERROR", "action 无效");
    await reviewWithdrawal(adminId, id, action);
    return ok({}, action === "approved" ? "【模拟】提现已审核通过（未真实打款）" : "提现已驳回"); }
  catch (e) { if (e instanceof AdminForbiddenError) return forbidden(e.message); if (e instanceof Error && (e as { code?: string }).code === "UNAUTHORIZED") return unauthorized(); return err("VALIDATION_ERROR", (e as Error).message); }
}
