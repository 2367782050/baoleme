import { requireAuth } from "@/lib/auth";
import { listCommissions } from "@/lib/services/referral.service";
import { ok, unauthorized } from "@/lib/utils/api-response";
function ua(e: unknown) { if (e instanceof Error && (e as { code?: string }).code === "UNAUTHORIZED") return unauthorized(); return null; }
export async function GET() { try { const s = await requireAuth(); return ok(await listCommissions(s.userId)); } catch (e) { return ua(e) ?? (() => { throw e; })(); } }
