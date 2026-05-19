import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { mockPayOrder } from "@/lib/services/billing.service";
import { ok, err, unauthorized } from "@/lib/utils/api-response";
function ua(e: unknown) { if (e instanceof Error && (e as { code?: string }).code === "UNAUTHORIZED") return unauthorized(); return null; }

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const s = await requireAuth(); const { id } = await params;
    const result = await mockPayOrder(id, s.userId);
    return ok(result, "【模拟】支付成功（未真实扣款）"); }
  catch (e) { return ua(e) ?? err("VALIDATION_ERROR", (e as Error).message); }
}
