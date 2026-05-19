import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createGenerationJob } from "@/lib/services/prompt-generation.service";
import { GroupNotFoundError } from "@/lib/services/prompt.service";
import { QuotaExceededError } from "@/lib/services/quota.service";
import { enqueuePromptGeneration } from "@/lib/queue";
import { ok, err, quotaExceeded, unauthorized } from "@/lib/utils/api-response";

function handleAuthError(e: unknown) {
  if (e instanceof Error && (e as { code?: string }).code === "UNAUTHORIZED") {
    return unauthorized();
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();

    const job = await createGenerationJob(session.userId, body.groupId ?? null, body);
    // Enqueue for async processing
    enqueuePromptGeneration(job.id);

    return ok({ jobId: job.id, status: job.status });
  } catch (e) {
    if (e instanceof GroupNotFoundError) {
      return err("NOT_FOUND", e.message, undefined, 404);
    }
    if (e instanceof QuotaExceededError) {
      return quotaExceeded(e.message);
    }
    return handleAuthError(e) ?? (() => { throw e; })();
  }
}
