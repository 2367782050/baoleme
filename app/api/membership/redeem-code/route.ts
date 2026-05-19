import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { redeemMembershipCode } from "@/lib/services/membership-code.service";
import { ok, err, unauthorized } from "@/lib/utils/api-response";
function ua(e: unknown) { if (e instanceof Error && (e as { code?: string }).code === "UNAUTHORIZED") return unauthorized(); return null; }

export async function POST(req: NextRequest) {
  try { const s = await requireAuth(); const { code } = await req.json(); if (!code) return err("VALIDATION_ERROR", "请输入会员码");
    const planName = await redeemMembershipCode(s.userId, code);
    return ok({ planName }, `【模拟】会员码兑换成功，已开通 ${planName}`); }
  catch (e) { return ua(e) ?? err("VALIDATION_ERROR", (e as Error).message); }
}
