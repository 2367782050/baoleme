/**
 * Prompt generation queue.
 *
 * In MVP: job is created in DB as "pending" and picked up by ai-worker.ts.
 * No setImmediate — the worker polls the DB independently.
 *
 * Real production should use BullMQ with Redis.
 */

export async function enqueuePromptGeneration(jobId: string): Promise<void> {
  // Default: inline execution (setImmediate).
  // In production with standalone worker, set AI_WORKER_EXTERNAL=true
  // and the job will be picked up by scripts/ai-worker.ts from the DB.
  if (process.env.AI_WORKER_EXTERNAL !== "true") {
    const { executeGenerationJob } = await import("@/lib/services/prompt-generation.service");
    // Mark as running before executing
    const { prisma } = await import("@/lib/db");
    try {
      await prisma.promptGenerationJob.update({
        where: { id: jobId },
        data: { status: "running", startedAt: new Date(), attempts: { increment: 1 } },
      });
    } catch { /* already claimed */ }
    setImmediate(async () => {
      try { await executeGenerationJob(jobId); } catch { /* error saved to DB */ }
    });
    return;
  }
  // External worker mode: job is pending in DB, worker polls and executes.
}

/**
 * Inline execution for tests — used when AI_WORKER_INLINE=true.
 */
export async function executeJobInline(jobId: string): Promise<void> {
  const { executeGenerationJob } = await import("@/lib/services/prompt-generation.service");
  await executeGenerationJob(jobId);
}
