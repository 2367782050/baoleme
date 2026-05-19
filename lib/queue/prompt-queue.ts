import { executeGenerationJob } from "@/lib/services/prompt-generation.service";

export type PromptJobMessage = {
  type: "prompt_generation";
  jobId: string;
};

/**
 * Simple in-process queue for MVP.
 * Real production should use BullMQ with Redis.
 */
export async function enqueuePromptGeneration(jobId: string): Promise<void> {
  // In MVP, we process immediately in a "fire and forget" manner.
  // In production, this would push to a Redis queue.
  setImmediate(async () => {
    try {
      await executeGenerationJob(jobId);
    } catch {
      // Error already saved to job record by executeGenerationJob
    }
  });
}
