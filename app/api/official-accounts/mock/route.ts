import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { pushDraft } from "@/lib/services/official-account.service";
import { QuotaExceededError } from "@/lib/services/quota.service";
import { ok, err, unauthorized, quotaExceeded } from "@/lib/utils/api-response";
function ua(e: unknown) { if (e instanceof Error && (e as { code?: string }).code === "UNAUTHORIZED") return unauthorized(); return null; }

export async function POST(req: NextRequest) {
  try { const s = await requireAuth(); const { articleId, officialAccountId } = await req.json();
    const task = await pushDraft(s.userId, articleId, officialAccountId);
    return ok({ id: task.id, status: task.status, externalDraftId: task.externalDraftId }, "【模拟】草稿已推送"); }
  catch (e) { if (e instanceof QuotaExceededError) return quotaExceeded(e.message); return ua(e) ?? err("VALIDATION_ERROR", (e as Error).message); }
}
