import { prisma } from "@/lib/db";
import type { Prisma, Article, ArticleGenerationJob } from "@/lib/generated/prisma/client";
import { assertCanUse, consume } from "./quota.service";
import { createConfiguredProvider } from "@/lib/adapters/ai";
import type { AnalyzeMaterialInput, ArticleWritingMode, GenerateArticleInput, ReviewArticleInput, RewriteArticleInput } from "@/lib/adapters/ai/types";
import { PromptNotFoundError } from "./prompt.service";
import { ArticleGroupNotFoundError } from "./article.service";

export async function createArticleGenerationJob(
  userId: string,
  input: {
    title?: string;
    promptId?: string;
    groupId?: string;
    sourceUrl?: string;
    referenceUrls?: string[];
    materialText?: string;
    writingMode?: string;
    targetAudience?: string;
    corePoint?: string;
    personalExperience?: string;
    forbiddenExpressions?: string;
    expectedTone?: string;
    contentDomain?: string;
    promptContextSummary?: unknown;
    imageCount?: number;
    imageStrategy?: string;
    needMaterial?: boolean;
  },
): Promise<{ article: Article; job: ArticleGenerationJob }> {
  await assertCanUse(userId, "article_generate");

  const groupId = input.groupId?.trim() ? input.groupId : null;
  const promptId = input.promptId?.trim() ? input.promptId : null;
  const writingMode = normalizeWritingMode(input.writingMode);

  if (groupId) {
    const g = await prisma.articleGroup.findUnique({ where: { id: groupId } });
    if (!g || g.userId !== userId) throw new ArticleGroupNotFoundError("分组不存在");
  }
  if (promptId) {
    const p = await prisma.prompt.findUnique({ where: { id: promptId } });
    if (!p || p.userId !== userId) throw new PromptNotFoundError("提示词不存在");
  }

  const article = await prisma.article.create({
    data: {
      userId,
      groupId,
      promptId,
      title: input.title ?? null,
      status: "generating",
      generationConfig: { ...input, writingMode } as Prisma.InputJsonValue,
    },
  });

  const job = await prisma.articleGenerationJob.create({
    data: {
      userId,
      articleId: article.id,
      status: "pending",
      input: { ...input, writingMode } as Prisma.InputJsonValue,
    },
  });

  return { article, job };
}

const ARTICLE_WRITING_MODES: ArticleWritingMode[] = ["quick", "material_based", "viral_deep", "humanized"];

export class ArticleGenerationValidationError extends Error {
  code = "VALIDATION_ERROR";
  statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = "ArticleGenerationValidationError";
  }
}

function normalizeWritingMode(mode?: string): ArticleWritingMode {
  if (!mode) return "quick";
  if (ARTICLE_WRITING_MODES.includes(mode as ArticleWritingMode)) return mode as ArticleWritingMode;
  throw new ArticleGenerationValidationError("写作模式不合法，请选择 quick、material_based、viral_deep 或 humanized");
}

export async function getArticleGenerationJob(jobId: string, userId: string): Promise<ArticleGenerationJob | null> {
  const j = await prisma.articleGenerationJob.findUnique({ where: { id: jobId } });
  if (!j || j.userId !== userId) return null;
  return j;
}

export async function executeArticleGenerationJob(jobId: string): Promise<void> {
  const job = await prisma.articleGenerationJob.findUnique({ where: { id: jobId } });
  if (!job) return;
  if (job.status !== "running") return;

  // Defensive: verify article exists and belongs to same user
  const article = await prisma.article.findUnique({ where: { id: job.articleId } });
  if (!article || article.userId !== job.userId) {
    await prisma.articleGenerationJob.update({
      where: { id: jobId },
      data: { status: "failed", errorMessage: "关联文章不存在或归属异常", completedAt: new Date() },
    });
    return;
  }

  // Defensive: verify prompt belongs to same user if provided
  if (article.promptId) {
    const p = await prisma.prompt.findUnique({ where: { id: article.promptId } });
    if (!p || p.userId !== job.userId) {
      await prisma.articleGenerationJob.update({
        where: { id: jobId },
        data: { status: "failed", errorMessage: "关联提示词不存在或归属异常", completedAt: new Date() },
      });
      await prisma.article.update({
        where: { id: article.id },
        data: { status: "failed" },
      });
      return;
    }
  }

  // Defensive: verify user still exists
  const user = await prisma.user.findUnique({ where: { id: job.userId } });
  if (!user) {
    await prisma.articleGenerationJob.update({
      where: { id: jobId },
      data: { status: "failed", errorMessage: "用户不存在", completedAt: new Date() },
    });
    return;
  }

  await prisma.article.update({ where: { id: article.id }, data: { status: "generating" } });

  let totalTokens = 0;

  try {
    const provider = await createConfiguredProvider();
    const inp = job.input as Record<string, unknown>;
    const writingMode = normalizeWritingMode(inp.writingMode as string | undefined);

    // Step 1: Material analysis
    const materialAnalysis = await provider.analyzeMaterial({
      contentDomain: (inp.contentDomain as string) || "通用",
      targetAudience: (inp.targetAudience as string) || "自媒体读者",
      sourceType: "article",
      materialText: [
        inp.materialText as string,
        inp.sourceUrl ? `主来源链接：${inp.sourceUrl as string}` : "",
        Array.isArray(inp.referenceUrls) ? (inp.referenceUrls as string[]).join("\n") : "",
      ].filter(Boolean).join("\n"),
    } as AnalyzeMaterialInput);
    totalTokens += materialAnalysis.usage.totalTokens;

    // Step 2: Read prompt content (already verified above)
    let promptContent = "";
    if (article.promptId) {
      const p = await prisma.prompt.findUnique({ where: { id: article.promptId } });
      if (p) promptContent = p.content;
    }

    // Step 3: Generate article
    const genResult = await provider.generateArticle({
      title: (inp.title as string) ?? "未命名",
      promptContent,
      materialAnalysisJson: JSON.stringify(materialAnalysis.result),
      referenceUrls: (inp.referenceUrls as string[]) ?? [],
      materialText: (inp.materialText as string) ?? "",
      writingMode,
      targetAudience: (inp.targetAudience as string) ?? "",
      corePoint: (inp.corePoint as string) ?? "",
      personalExperience: (inp.personalExperience as string) ?? "",
      forbiddenExpressions: (inp.forbiddenExpressions as string) ?? "",
      expectedTone: (inp.expectedTone as string) ?? "",
      contentDomain: (inp.contentDomain as string) ?? "",
      promptContextSummary: inp.promptContextSummary ?? null,
      wordCount: 1500,
      imageCount: (inp.imageCount as number) ?? 0,
      imageStrategy: (inp.imageStrategy as string) ?? "none",
      headingStyle: "numbered",
      enableAIDetectionEvasion: false,
    } as GenerateArticleInput);
    totalTokens += genResult.usage.totalTokens;

    let finalMarkdown = genResult.result.markdown;
    let finalTitle = genResult.result.title;
    let rewriteApplied = false;
    let rewriteSummary: string[] = [];
    const humanizationReport = genResult.result.humanizationReport
      ? { ...genResult.result.humanizationReport, writingMode }
      : undefined;

    // Step 4: Review
    const reviewResult = await provider.reviewArticle({
      title: finalTitle,
      materialAnalysisJson: JSON.stringify(materialAnalysis.result),
      markdown: finalMarkdown,
    } as ReviewArticleInput);
    totalTokens += reviewResult.usage.totalTokens;

    // Step 5: Rewrite if needed
    if (reviewResult.result.rewriteRequired) {
      const rewriteResult = await provider.rewriteArticle({
        title: finalTitle,
        markdown: finalMarkdown,
        reviewProblemsJson: JSON.stringify(reviewResult.result.problems),
        rewriteInstructions: reviewResult.result.rewriteInstructions,
      } as RewriteArticleInput);
      totalTokens += rewriteResult.usage.totalTokens;
      finalMarkdown = rewriteResult.result.markdown;
      finalTitle = rewriteResult.result.title;
      rewriteApplied = true;
      rewriteSummary = rewriteResult.result.changeSummary;
    }

    const resultMetadata: Record<string, unknown> = {
      ...(job.input as Record<string, unknown>),
      writingMode,
      materialAnalysis: materialAnalysis.result,
      reviewResult: reviewResult.result,
      rewriteApplied,
      rewriteSummary,
      riskNotes: genResult.result.riskNotes,
      tokenUsage: totalTokens,
    };
    const jobResultMetadata: Record<string, unknown> = {
      totalTokens,
      writingMode,
      rewriteApplied,
      rewriteSummary,
    };
    if (genResult.result.draftMarkdown !== undefined) {
      resultMetadata.draftMarkdown = genResult.result.draftMarkdown;
      jobResultMetadata.draftMarkdown = genResult.result.draftMarkdown;
    }
    if (humanizationReport !== undefined) {
      resultMetadata.humanizationReport = humanizationReport;
      jobResultMetadata.humanizationReport = humanizationReport;
    }

    await prisma.article.update({
      where: { id: article.id },
      data: {
        title: finalTitle,
        markdownContent: finalMarkdown,
        status: "completed",
        generationConfig: resultMetadata as Prisma.InputJsonValue,
      },
    });

    await prisma.articleGenerationJob.update({
      where: { id: jobId },
      data: {
        status: "completed",
        completedAt: new Date(),
        tokenUsage: jobResultMetadata as Prisma.InputJsonValue,
      },
    });

    await consume(job.userId, "article_generate", 1);
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "未知错误";
    await prisma.articleGenerationJob.update({
      where: { id: jobId },
      data: { status: "failed", errorMessage, completedAt: new Date() },
    });
    await prisma.article.update({
      where: { id: article.id },
      data: { status: "failed" },
    });
    throw e;
  }
}

export async function retryArticleGenerationJob(jobId: string, userId: string): Promise<ArticleGenerationJob> {
  const job = await getArticleGenerationJob(jobId, userId);
  if (!job) throw new Error("任务不存在");
  if (job.status !== "failed") throw new Error("只能重试失败的任务");

  const updated = await prisma.articleGenerationJob.update({
    where: { id: jobId },
    data: { status: "pending", errorMessage: null, startedAt: null, completedAt: null },
  });
  return updated;
}
