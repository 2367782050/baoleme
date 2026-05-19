import { requireAuth } from "@/lib/auth";
import { getQuotaUsage } from "@/lib/services/quota.service";
import type { CapabilityKey } from "@/lib/services/quota.service";
import { ok, err, unauthorized } from "@/lib/utils/api-response";

export async function GET() {
  try {
    const session = await requireAuth();

    const capabilities: CapabilityKey[] = [
      "prompt_generate",
      "article_generate",
      "material_export",
      "image_upload",
      "draft_push",
      "official_account_bind",
    ];

    const quota: Record<string, { used: number; limit: number; remaining: number }> = {};
    for (const cap of capabilities) {
      const { used, limit } = await getQuotaUsage(session.userId, cap);
      quota[cap] = { used, limit, remaining: Math.max(0, limit - used) };
    }

    return ok(quota);
  } catch (e) {
    if (e instanceof Error && (e as { code?: string }).code === "UNAUTHORIZED") {
      return unauthorized((e as Error).message);
    }
    return err("INTERNAL_ERROR", "服务器内部错误", undefined, 500);
  }
}
