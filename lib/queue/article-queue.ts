import { executeArticleGenerationJob } from "@/lib/services/article-generation.service";

export async function enqueueArticleGeneration(jobId: string): Promise<void> {
  setImmediate(async () => {
    try {
      await executeArticleGenerationJob(jobId);
    } catch {
      // Error already saved to job record
    }
  });
}
