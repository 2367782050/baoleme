import { listActivePlans } from "@/lib/services/membership.service";
import { ok } from "@/lib/utils/api-response";

export async function GET() {
  const plans = await listActivePlans();
  return ok(plans.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    priceCents: p.priceCents,
    originalPriceCents: p.originalPriceCents,
    durationDays: p.durationDays,
    capabilities: p.capabilities,
  })));
}
