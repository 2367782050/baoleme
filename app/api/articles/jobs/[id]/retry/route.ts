import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { retryArticleGenerationJob, getArticleGenerationJob } from "@/lib/services/article-generation.service";
import { enqueueArticleGeneration } from "@/lib/queue";
import { ok, err, unauthorized } from "@/lib/utils/api-response";

function ua(e: unknown) {
  if (e instanceof Error && (e as { code?: string }).code === "UNAUTHORIZED") return unauthorized();
  return null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireAuth();
    const { id } = await params;

    // Check job exists and belongs to user
    const existing = await getArticleGenerationJob(id, s.userId);
    if (!existing) return err("NOT_FOUND", "任务不存在", undefined, 404);
    if (existing.status !== "failed") return err("VALIDATION_ERROR", "只能重试失败的任务", undefined, 409);

    const job = await retryArticleGenerationJob(id, s.userId);
    enqueueArticleGeneration(job.id);
    return ok({ jobId: job.id, status: job.status }, "任务已重新入队");
  } catch (e) {
    return ua(e) ?? err("INTERNAL_ERROR", "服务器内部错误", undefined, 500);
  }
}
