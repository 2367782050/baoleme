import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createWithdrawal, listWithdrawals } from "@/lib/services/referral.service";
import { ok, err, unauthorized } from "@/lib/utils/api-response";
function ua(e: unknown) { if (e instanceof Error && (e as { code?: string }).code === "UNAUTHORIZED") return unauthorized(); return null; }

export async function GET() { try { const s = await requireAuth(); return ok(await listWithdrawals(s.userId)); } catch (e) { return ua(e) ?? err("INTERNAL_ERROR", "服务器内部错误", undefined, 500); } }
export async function POST(req: NextRequest) {
  try { const s = await requireAuth(); const { amountCents, alipayName, alipayAccount } = await req.json();
    if (!amountCents || amountCents <= 0) return err("VALIDATION_ERROR", "提现金额必须大于0");
    const w = await createWithdrawal(s.userId, { amountCents, alipayName, alipayAccount });
    return ok(w, "【模拟】提现申请已提交（未真实打款）"); }
  catch (e) { return ua(e) ?? err("VALIDATION_ERROR", (e as Error).message); }
}
