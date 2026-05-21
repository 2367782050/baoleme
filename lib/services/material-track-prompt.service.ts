/**
 * Phase 23: Track prompt generation service.
 * Validates 3-10 articles, creates PromptGenerationJob with mode=track_prompt_from_materials.
 */

import { prisma } from "@/lib/db";
import { assertCanUse } from "./quota.service";

export async function createTrackPromptJob(
  userId: string,
  input: {
    domainId: string;
    articleIds: string[];
    name: string;
    targetAudience: string;
    authorPersona: string;
    userNotes?: string;
    groupId?: string | null;
  },
) {
  // Validate article count
  if (input.articleIds.length < 3) throw new Error("至少需要选择 3 篇文章");
  if (input.articleIds.length > 10) throw new Error("最多只能选择 10 篇文章");

  // Validate domain
  const domain = await prisma.materialDomain.findUnique({ where: { id: input.domainId } });
  if (!domain) throw new Error("赛道不存在");

  // Validate group ownership
  if (input.groupId) {
    const group = await prisma.promptGroup.findUnique({ where: { id: input.groupId } });
    if (!group || group.userId !== userId) throw new Error("提示词分组不存在");
  }

  // Validate all articles exist, belong to user or are public seed, and have fullContent
  const articles = await prisma.materialArticle.findMany({
    where: { id: { in: input.articleIds } },
  });
  if (articles.length !== input.articleIds.length) throw new Error("部分文章不存在");
  for (const a of articles) {
    // Allow seed articles or user-imported
    if (a.importedByUserId !== userId && a.importSource === "seed") continue;
    if (a.importedByUserId !== userId) throw new Error(`文章「${a.title}」不属于你`);
    if (!a.fullContent) throw new Error(`文章「${a.title}」没有全文内容，无法用于拆解`);
  }

  await assertCanUse(userId, "prompt_generate");

  const job = await prisma.promptGenerationJob.create({
    data: {
      userId,
      groupId: input.groupId ?? null,
      status: "pending",
      input: {
        mode: "track_prompt_from_materials",
        domainId: input.domainId,
        domainName: domain.name,
        articleIds: input.articleIds,
        name: input.name,
        targetAudience: input.targetAudience,
        authorPersona: input.authorPersona,
        userNotes: input.userNotes ?? "",
      },
    },
  });

  return job;
}
