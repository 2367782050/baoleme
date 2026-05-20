/**
 * Article generation queue.
 *
 * In MVP: job is created in DB as "pending" and picked up by ai-worker.ts.
 * No setImmediate — the worker polls the DB independently.
 */

export async function enqueueArticleGeneration(_jobId: string): Promise<void> {
  // Job is already in DB with status "pending".
  // The ai-worker.ts script polls and executes it.
}

/**
 * Inline execution for tests — used when AI_WORKER_INLINE=true.
 */
export async function executeArticleJobInline(jobId: string): Promise<void> {
  const { executeArticleGenerationJob } = await import("@/lib/services/article-generation.service");
  await executeArticleGenerationJob(jobId);
}
