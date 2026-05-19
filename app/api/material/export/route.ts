import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { exportMaterial } from "@/lib/services/material.service";
import { QuotaExceededError } from "@/lib/services/quota.service";
import { ok, err, unauthorized, quotaExceeded } from "@/lib/utils/api-response";

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();

    const { type, filters } = body;
    if (!type || !["accounts", "articles", "topics"].includes(type)) {
      return err("VALIDATION_ERROR", "type 无效");
    }

    const csv = await exportMaterial(session.userId, type, filters ?? {});
    return ok({ csv });
  } catch (e) {
    if (e instanceof QuotaExceededError) {
      return quotaExceeded(e.message);
    }
    if (e instanceof Error && (e as { code?: string }).code === "UNAUTHORIZED") {
      return unauthorized();
    }
    throw e;
  }
}
