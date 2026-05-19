import { NextRequest } from "next/server";
import { requireAdmin, AdminForbiddenError } from "@/lib/auth/admin-guard";
import { adminGrantMembership } from "@/lib/services/admin.service";
import { ok, err, forbidden, unauthorized } from "@/lib/utils/api-response";

export async function POST(req: NextRequest) {
  try { const { userId: adminId } = await requireAdmin(); const { userId, planId, durationDays } = await req.json();
    if (!userId || !planId) return err("VALIDATION_ERROR", "userId 和 planId 为必填");
    await adminGrantMembership(adminId, userId, planId, durationDays);
    return ok({}, "会员已开通"); }
  catch (e) { if (e instanceof AdminForbiddenError) return forbidden(e.message); if (e instanceof Error && (e as { code?: string }).code === "UNAUTHORIZED") return unauthorized(); return err("VALIDATION_ERROR", (e as Error).message); }
}
