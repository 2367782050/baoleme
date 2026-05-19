import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createArticleGenerationJob } from "@/lib/services/article-generation.service";
import { QuotaExceededError } from "@/lib/services/quota.service";
import { PromptNotFoundError } from "@/lib/services/prompt.service";
import { ArticleGroupNotFoundError } from "@/lib/services/article.service";
import { enqueueArticleGeneration } from "@/lib/queue";
import { ok, err, quotaExceeded, unauthorized } from "@/lib/utils/api-response";

function ua(e: unknown) {
  if (e instanceof Error && (e as { code?: string }).code === "UNAUTHORIZED") return unauthorized();
  return null;
}

export async function POST(req: NextRequest) {
  try { const s = await requireAuth(); const body = await req.json();
    const { article, job } = await createArticleGenerationJob(s.userId, body);
    enqueueArticleGeneration(job.id);
    return ok({ articleId: article.id, jobId: job.id, status: job.status });
  } catch (e) {
    if (e instanceof QuotaExceededError) return quotaExceeded(e.message);
    if (e instanceof PromptNotFoundError || e instanceof ArticleGroupNotFoundError) return err("NOT_FOUND", e.message, undefined, 404);
    return ua(e) ?? (() => { throw e; })();
  }
}
