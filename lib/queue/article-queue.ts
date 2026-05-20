/**
 * Article generation queue.
 *
 * In MVP: job is created in DB as "pending" and picked up by ai-worker.ts.
 * No setImmediate — the worker polls the DB independently.
 */

export async function enqueueArticleGeneration(jobId: string): Promise<void> {
  if (process.env.AI_WORKER_EXTERNAL !== "true") {
    const { executeArticleGenerationJob } = await import("@/lib/services/article-generation.service");
    const { prisma } = await import("@/lib/db");
    try {
      await prisma.articleGenerationJob.update({
        where: { id: jobId },
        data: { status: "running", startedAt: new Date(), attempts: { increment: 1 } },
      });
    } catch { /* already claimed */ }
    setImmediate(async () => {
      try { await executeArticleGenerationJob(jobId); } catch { /* error saved to DB */ }
    });
    return;
  }
}

/**
 * Inline execution for tests — used when AI_WORKER_INLINE=true.
 */
export async function executeArticleJobInline(jobId: string): Promise<void> {
  const { executeArticleGenerationJob } = await import("@/lib/services/article-generation.service");
  await executeArticleGenerationJob(jobId);
}
