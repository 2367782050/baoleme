import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createOrder, listOrders } from "@/lib/services/billing.service";
import { ok, err, unauthorized } from "@/lib/utils/api-response";
function ua(e: unknown) { if (e instanceof Error && (e as { code?: string }).code === "UNAUTHORIZED") return unauthorized(); return null; }

export async function GET() {
  try { const s = await requireAuth(); return ok(await listOrders(s.userId)); } catch (e) { return ua(e) ?? (() => { throw e; })(); }
}
export async function POST(req: NextRequest) {
  try { const s = await requireAuth(); const { planId } = await req.json(); if (!planId) return err("VALIDATION_ERROR", "planId 不能为空");
    const o = await createOrder(s.userId, planId);
    return ok(o, "【模拟】订单创建成功"); }
  catch (e) { return ua(e) ?? err("VALIDATION_ERROR", (e as Error).message); }
}
