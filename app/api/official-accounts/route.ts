import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createMockOfficialAccount, listOfficialAccounts, deleteOfficialAccount, OfficialAccountNotFoundError, OfficialAccountQuotaExceededError } from "@/lib/services/official-account.service";
import { ok, err, quotaExceeded, unauthorized } from "@/lib/utils/api-response";
function ua(e: unknown) { if (e instanceof Error && (e as { code?: string }).code === "UNAUTHORIZED") return unauthorized(); return null; }

export async function GET(req: NextRequest) {
  try { const s = await requireAuth(); const gid = req.nextUrl.searchParams.get("groupId") ?? undefined; return ok(await listOfficialAccounts(s.userId, gid)); } catch (e) { return ua(e) ?? err("INTERNAL_ERROR", "服务器内部错误", undefined, 500); }
}
export async function POST(req: NextRequest) {
  try { const s = await requireAuth(); const { name, groupId, appid } = await req.json(); if (!name) return err("VALIDATION_ERROR", "公众号名称不能为空");
    return ok(await createMockOfficialAccount(s.userId, groupId ?? null, name, appid), "【模拟】公众号创建成功"); }
  catch (e) { if (e instanceof OfficialAccountQuotaExceededError) return quotaExceeded(e.message); return ua(e) ?? err("VALIDATION_ERROR", (e as Error).message); }
}
export async function DELETE(req: NextRequest) {
  try { const s = await requireAuth(); const id = req.nextUrl.searchParams.get("id"); if (!id) return err("VALIDATION_ERROR", "id 不能为空");
    await deleteOfficialAccount(id, s.userId); return ok({}, "已删除"); }
  catch (e) { if (e instanceof OfficialAccountNotFoundError) return err("NOT_FOUND", e.message, undefined, 404); return ua(e) ?? err("INTERNAL_ERROR", "服务器内部错误", undefined, 500); }
}
