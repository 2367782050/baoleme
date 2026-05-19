import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getGenerationJob } from "@/lib/services/prompt-generation.service";
import { ok, err, unauthorized } from "@/lib/utils/api-response";

function handleAuthError(e: unknown) {
  if (e instanceof Error && (e as { code?: string }).code === "UNAUTHORIZED") {
    return unauthorized();
  }
  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const job = await getGenerationJob(id, session.userId);
    if (!job) {
      return err("NOT_FOUND", "任务不存在", undefined, 404);
    }
    return ok({
      id: job.id,
      status: job.status,
      outputPromptId: job.outputPromptId,
      errorMessage: job.errorMessage,
      tokenUsage: job.tokenUsage,
    });
  } catch (e) {
    return handleAuthError(e) ?? err("INTERNAL_ERROR", "服务器内部错误", undefined, 500);
  }
}
