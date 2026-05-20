/**
 * Prompt generation queue.
 *
 * In MVP: job is created in DB as "pending" and picked up by ai-worker.ts.
 * No setImmediate — the worker polls the DB independently.
 *
 * Real production should use BullMQ with Redis.
 */

export async function enqueuePromptGeneration(_jobId: string): Promise<void> {
  // Job is already in DB with status "pending".
  // The ai-worker.ts script polls and executes it.
  // Nothing to do here in MVP.
}

/**
 * Inline execution for tests — used when AI_WORKER_INLINE=true.
 */
export async function executeJobInline(jobId: string): Promise<void> {
  const { executeGenerationJob } = await import("@/lib/services/prompt-generation.service");
  await executeGenerationJob(jobId);
}
