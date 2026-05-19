import { requireAuth } from "@/lib/auth";
import { findUserById } from "@/lib/services/user.service";
import { findActiveMembership, getPlanCapabilities } from "@/lib/services/membership.service";
import { getQuotaUsage } from "@/lib/services/quota.service";
import type { CapabilityKey } from "@/lib/services/quota.service";
import { ok, err, unauthorized } from "@/lib/utils/api-response";

export async function GET() {
  try {
    const session = await requireAuth();
    const user = await findUserById(session.userId);
    if (!user) {
      return unauthorized();
    }

    const membership = await findActiveMembership(session.userId);

    // Gather quota summary
    const capabilities: CapabilityKey[] = [
      "prompt_generate",
      "article_generate",
      "material_export",
      "image_upload",
      "draft_push",
      "official_account_bind",
    ];
    const quotaSummary: Record<string, { used: number; limit: number }> = {};
    for (const cap of capabilities) {
      quotaSummary[cap] = await getQuotaUsage(session.userId, cap);
    }

    return ok({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        referralCode: user.referralCode,
        createdAt: user.createdAt,
      },
      membership: membership
        ? {
            planName: membership.plan.name,
            planCode: membership.plan.code,
            status: membership.status,
            expiresAt: membership.expiresAt,
            capabilities: getPlanCapabilities(membership.plan),
          }
        : null,
      quota: quotaSummary,
    });
  } catch (e) {
    if (e instanceof Error && (e as { code?: string }).code === "UNAUTHORIZED") {
      return unauthorized((e as Error).message);
    }
    return err("INTERNAL_ERROR", "服务器内部错误", undefined, 500);
  }
}
