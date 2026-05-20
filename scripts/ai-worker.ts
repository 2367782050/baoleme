/**
 * Phase 20C: Database-persistent AI task worker — maxAttempts-aware.
 *
 * - Atomic claim: queries eligible candidates, checks attempts < maxAttempts in JS,
 *   then updateMany to atomically claim.
 * - Stale running recovery uses maxAttempts per job (not hardcoded 3).
 * - Only claims one job at a time per poll cycle.
 */

import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { executeGenerationJob } from "../lib/services/prompt-generation.service.js";
import { executeArticleGenerationJob } from "../lib/services/article-generation.service.js";

const POLL_MS = parseInt(process.env.AI_WORKER_POLL_MS ?? "2000", 10);
const STALE_MS = parseInt(process.env.AI_WORKER_STALE_MS ?? "600000", 10);

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function recoverStaleRunning() {
  const staleThreshold = new Date(Date.now() - STALE_MS);

  // Fetch stale running jobs with their maxAttempts
  const stalePromptJobs = await prisma.promptGenerationJob.findMany({
    where: { status: "running", startedAt: { lt: staleThreshold } },
    select: { id: true, attempts: true, maxAttempts: true },
  });

  for (const j of stalePromptJobs) {
    if (j.attempts < j.maxAttempts) {
      await prisma.promptGenerationJob.update({
        where: { id: j.id },
        data: { status: "pending" },
      });
      console.log(`[worker] Recovered stale prompt job ${j.id.substring(0, 8)} → pending`);
    } else {
      await prisma.promptGenerationJob.update({
        where: { id: j.id },
        data: {
          status: "failed",
          errorMessage: "任务执行超时，多次重试后仍失败",
          completedAt: new Date(),
        },
      });
      console.log(`[worker] Dead prompt job ${j.id.substring(0, 8)} → failed`);
    }
  }

  const staleArticleJobs = await prisma.articleGenerationJob.findMany({
    where: { status: "running", startedAt: { lt: staleThreshold } },
    select: { id: true, attempts: true, maxAttempts: true },
  });

  for (const j of staleArticleJobs) {
    if (j.attempts < j.maxAttempts) {
      await prisma.articleGenerationJob.update({
        where: { id: j.id },
        data: { status: "pending" },
      });
      console.log(`[worker] Recovered stale article job ${j.id.substring(0, 8)} → pending`);
    } else {
      await prisma.articleGenerationJob.update({
        where: { id: j.id },
        data: {
          status: "failed",
          errorMessage: "任务执行超时，多次重试后仍失败",
          completedAt: new Date(),
        },
      });
      console.log(`[worker] Dead article job ${j.id.substring(0, 8)} → failed`);
    }
  }
}

/**
 * Atomic claim: fetch ONE pending candidate with its maxAttempts,
 * check attempts < maxAttempts in JS, then atomically claim via updateMany.
 */
async function claimPromptJob(): Promise<string | null> {
  return prisma.$transaction(async (tx) => {
    const job = await tx.promptGenerationJob.findFirst({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      select: { id: true, attempts: true, maxAttempts: true },
    });
    if (!job || job.attempts >= job.maxAttempts) return null;

    const result = await tx.promptGenerationJob.updateMany({
      where: { id: job.id, status: "pending" },
      data: { status: "running", startedAt: new Date(), attempts: { increment: 1 } },
    });
    return result.count > 0 ? job.id : null;
  });
}

async function claimArticleJob(): Promise<string | null> {
  return prisma.$transaction(async (tx) => {
    const job = await tx.articleGenerationJob.findFirst({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      select: { id: true, attempts: true, maxAttempts: true },
    });
    if (!job || job.attempts >= job.maxAttempts) return null;

    const result = await tx.articleGenerationJob.updateMany({
      where: { id: job.id, status: "pending" },
      data: { status: "running", startedAt: new Date(), attempts: { increment: 1 } },
    });
    return result.count > 0 ? job.id : null;
  });
}

async function main() {
  console.log(`[worker] AI worker started. Poll: ${POLL_MS}ms, Stale: ${STALE_MS}ms`);
  console.log(`[worker] Press Ctrl+C to stop.`);

  await recoverStaleRunning();
  let lastRecovery = Date.now();

  const timer = setInterval(async () => {
    if (Date.now() - lastRecovery > 30000) {
      await recoverStaleRunning();
      lastRecovery = Date.now();
    }

    const promptId = await claimPromptJob();
    if (promptId) {
      console.log(`[worker] Claimed prompt job ${promptId.substring(0, 8)}`);
      try {
        await executeGenerationJob(promptId);
        const updated = await prisma.promptGenerationJob.findUnique({ where: { id: promptId } });
        console.log(`[worker] Prompt job ${promptId.substring(0, 8)} → ${updated?.status}`);
      } catch (e) {
        console.error(`[worker] Prompt job ${promptId.substring(0, 8)} error:`, (e as Error).message);
      }
      return;
    }

    const articleId = await claimArticleJob();
    if (articleId) {
      console.log(`[worker] Claimed article job ${articleId.substring(0, 8)}`);
      try {
        await executeArticleGenerationJob(articleId);
        const updated = await prisma.articleGenerationJob.findUnique({ where: { id: articleId } });
        console.log(`[worker] Article job ${articleId.substring(0, 8)} → ${updated?.status}`);
      } catch (e) {
        console.error(`[worker] Article job ${articleId.substring(0, 8)} error:`, (e as Error).message);
      }
    }
  }, POLL_MS);

  process.on("SIGINT", () => { clearInterval(timer); prisma.$disconnect(); process.exit(0); });
  process.on("SIGTERM", () => { clearInterval(timer); prisma.$disconnect(); process.exit(0); });
}

main();
