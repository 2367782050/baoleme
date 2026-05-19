import { NextRequest } from "next/server";
import { requireAdmin, AdminForbiddenError } from "@/lib/auth/admin-guard";
import { generateMembershipCodes } from "@/lib/services/admin.service";
import { ok, err, forbidden, unauthorized } from "@/lib/utils/api-response";

export async function POST(req: NextRequest) {
  try { const { userId: adminId } = await requireAdmin(); const { planId, count, expiresAt } = await req.json();
    if (!planId || !count) return err("VALIDATION_ERROR", "planId 和 count 为必填");
    const codes = await generateMembershipCodes(adminId, planId, Math.min(count, 100), expiresAt);
    return ok({ codes }, `已生成 ${codes.length} 个会员码`); }
  catch (e) { if (e instanceof AdminForbiddenError) return forbidden(e.message); if (e instanceof Error && (e as { code?: string }).code === "UNAUTHORIZED") return unauthorized(); return err("VALIDATION_ERROR", (e as Error).message); }
}
