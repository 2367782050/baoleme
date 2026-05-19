import { requireAuth } from "@/lib/auth";
import { findActiveMembership, getPlanCapabilities } from "@/lib/services/membership.service";
import { ok, err, unauthorized } from "@/lib/utils/api-response";

export async function GET() {
  try {
    const session = await requireAuth();
    const membership = await findActiveMembership(session.userId);

    if (!membership) {
      return ok({ membership: null });
    }

    return ok({
      membership: {
        planName: membership.plan.name,
        planCode: membership.plan.code,
        status: membership.status,
        startsAt: membership.startsAt,
        expiresAt: membership.expiresAt,
        source: membership.source,
        capabilities: getPlanCapabilities(membership.plan),
      },
    });
  } catch (e) {
    if (e instanceof Error && (e as { code?: string }).code === "UNAUTHORIZED") {
      return unauthorized((e as Error).message);
    }
    return err("INTERNAL_ERROR", "服务器内部错误", undefined, 500);
  }
}
