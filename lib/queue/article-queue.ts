/**
 * Article generation queue.
 *
 * Default: job is created in DB as "pending" and picked up by ai-worker.ts.
 * No setImmediate — the worker polls the DB independently.
 *
 * For test environments that need inline execution:
 *   AI_WORKER_MODE=inline-test
 */

export async function enqueueArticleGeneration(jobId: string): Promise<void> {
  if (process.env.AI_WORKER_MODE === "inline-test") {
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
  // Worker mode (default): job is pending in DB, ai-worker.ts polls and executes.
}
