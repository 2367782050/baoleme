import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getArticleGenerationJob } from "@/lib/services/article-generation.service";
import { ok, err, unauthorized } from "@/lib/utils/api-response";

function ua(e: unknown) {
  if (e instanceof Error && (e as { code?: string }).code === "UNAUTHORIZED") return unauthorized();
  return null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const s = await requireAuth(); const { id } = await params;
    const job = await getArticleGenerationJob(id, s.userId);
    if (!job) return err("NOT_FOUND", "任务不存在", undefined, 404);
    return ok({ id: job.id, articleId: job.articleId, status: job.status, errorMessage: job.errorMessage, attempts: job.attempts, tokenUsage: job.tokenUsage, startedAt: job.startedAt, completedAt: job.completedAt });
  } catch (e) { return ua(e) ?? (() => { throw e; })(); }
}
