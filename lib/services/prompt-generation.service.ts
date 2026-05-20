import { prisma } from "@/lib/db";
import type { Prisma, PromptGenerationJob } from "@/lib/generated/prisma/client";
import type { GeneratePromptInput } from "@/lib/adapters/ai";
import { assertCanUse, consume } from "./quota.service";
import { createConfiguredProvider } from "@/lib/adapters/ai";
import { GroupNotFoundError } from "./prompt.service";

export async function createGenerationJob(
  userId: string,
  groupId: string | null,
  input: Record<string, unknown>,
): Promise<PromptGenerationJob> {
  // Check quota before creating the job
  await assertCanUse(userId, "prompt_generate");

  // If groupId is provided, verify it belongs to this user
  if (groupId) {
    const group = await prisma.promptGroup.findUnique({ where: { id: groupId } });
    if (!group || group.userId !== userId) {
      throw new GroupNotFoundError("分组不存在");
    }
  }

  return prisma.promptGenerationJob.create({
    data: {
      userId,
      groupId,
      status: "pending",
      input: input as Prisma.InputJsonValue,
    },
  });
}

export async function getGenerationJob(
  jobId: string,
  userId: string,
): Promise<PromptGenerationJob | null> {
  const job = await prisma.promptGenerationJob.findUnique({
    where: { id: jobId },
  });
  if (!job || job.userId !== userId) return null;
  return job;
}

export async function executeGenerationJob(jobId: string): Promise<void> {
  const job = await prisma.promptGenerationJob.findUnique({
    where: { id: jobId },
  });
  if (!job || job.status !== "running") return;

  try {
    const provider = await createConfiguredProvider();
    const input = job.input as unknown as GeneratePromptInput;

    const { result, usage } = await provider.generatePrompt(input);

    // Save the generated prompt
    const prompt = await prisma.prompt.create({
      data: {
        userId: job.userId,
        groupId: job.groupId,
        name: result.name,
        content: result.content,
        sourceType: "generated",
        config: {
          summary: result.summary,
          recommendedInputs: result.recommendedInputs,
          titleRules: result.titleRules,
          structureRules: result.structureRules,
          styleRules: result.styleRules,
          materialRules: result.materialRules,
          forbiddenRules: result.forbiddenRules,
        } as Prisma.InputJsonValue,
      },
    });

    // Mark completed
    await prisma.promptGenerationJob.update({
      where: { id: jobId },
      data: {
        status: "completed",
        outputPromptId: prompt.id,
        completedAt: new Date(),
        tokenUsage: usage as Prisma.InputJsonValue,
      },
    });

    // Consume quota after success
    await consume(job.userId, "prompt_generate", 1);
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "未知错误";
    await prisma.promptGenerationJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        errorMessage,
        completedAt: new Date(),
      },
    });

    // Don't consume quota on failure
    throw e;
  }
}
