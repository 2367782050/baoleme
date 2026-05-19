import { requireAuth } from "@/lib/auth";
import { getReferralSummary } from "@/lib/services/referral.service";
import { ok, err, unauthorized } from "@/lib/utils/api-response";
function ua(e: unknown) { if (e instanceof Error && (e as { code?: string }).code === "UNAUTHORIZED") return unauthorized(); return null; }
export async function GET() { try { const s = await requireAuth(); return ok(await getReferralSummary(s.userId)); } catch (e) { return ua(e) ?? err("INTERNAL_ERROR", "服务器内部错误", undefined, 500); } }
