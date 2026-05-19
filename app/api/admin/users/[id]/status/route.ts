import { NextRequest } from "next/server";
import { requireAdmin, AdminForbiddenError } from "@/lib/auth/admin-guard";
import { setUserStatus } from "@/lib/services/admin.service";
import { ok, err, forbidden, unauthorized } from "@/lib/utils/api-response";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const { userId: adminId } = await requireAdmin(); const { id } = await params; const { status } = await req.json();
    if (status !== "active" && status !== "disabled") return err("VALIDATION_ERROR", "状态无效");
    await setUserStatus(adminId, id, status);
    return ok({}, `用户已${status === "active" ? "启用" : "禁用"}`); }
  catch (e) { if (e instanceof AdminForbiddenError) return forbidden(e.message); if (e instanceof Error && (e as { code?: string }).code === "UNAUTHORIZED") return unauthorized(); return err("VALIDATION_ERROR", (e as Error).message); }
}
