/**
 * Phase 20B: Database-persistent AI task worker — reliability hardened.
 *
 * - Atomic claim: updateMany where { id, status: "pending", attempts < maxAttempts }
 * - Only claims one job at a time per poll cycle
 * - Stale running recovery: running jobs older than AI_WORKER_STALE_MS
 *   are reset to pending (if under maxAttempts) or marked failed
 * - Job service writes startedAt, completedAt, attempts increment
 *
 * Usage:
 *   npm run worker:ai
 */

import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { executeGenerationJob } from "../lib/services/prompt-generation.service.js";
import { executeArticleGenerationJob } from "../lib/services/article-generation.service.js";

const POLL_MS = parseInt(process.env.AI_WORKER_POLL_MS ?? "2000", 10);
const STALE_MS = parseInt(process.env.AI_WORKER_STALE_MS ?? "600000", 10); // 10 min

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function recoverStaleRunning() {
  const staleThreshold = new Date(Date.now() - STALE_MS);

  // Prompt jobs
  const stalePrompts = await prisma.promptGenerationJob.updateMany({
    where: {
      status: "running",
      startedAt: { lt: staleThreshold },
      attempts: { lt: 3 },
    },
    data: { status: "pending" },
  });
  if (stalePrompts.count > 0) {
    console.log(`[worker] Recovered ${stalePrompts.count} stale prompt job(s) → pending`);
  }

  // Prompt jobs over maxAttempts — mark failed
  const deadPrompts = await prisma.promptGenerationJob.updateMany({
    where: {
      status: "running",
      startedAt: { lt: staleThreshold },
      attempts: { gte: 3 },
    },
    data: {
      status: "failed",
      errorMessage: "任务执行超时，多次重试后仍失败",
      completedAt: new Date(),
    },
  });
  if (deadPrompts.count > 0) {
    console.log(`[worker] Marked ${deadPrompts.count} dead prompt job(s) → failed`);
  }

  // Article jobs
  const staleArticles = await prisma.articleGenerationJob.updateMany({
    where: {
      status: "running",
      startedAt: { lt: staleThreshold },
      attempts: { lt: 3 },
    },
    data: { status: "pending" },
  });
  if (staleArticles.count > 0) {
    console.log(`[worker] Recovered ${staleArticles.count} stale article job(s) → pending`);
  }

  const deadArticles = await prisma.articleGenerationJob.updateMany({
    where: {
      status: "running",
      startedAt: { lt: staleThreshold },
      attempts: { gte: 3 },
    },
    data: {
      status: "failed",
      errorMessage: "任务执行超时，多次重试后仍失败",
      completedAt: new Date(),
    },
  });
  if (deadArticles.count > 0) {
    console.log(`[worker] Marked ${deadArticles.count} dead article job(s) → failed`);
  }
}

/**
 * Atomic claim: atomically mark ONE pending job as running.
 * Uses a transaction: find the first eligible job, then updateMany to claim it.
 * This prevents multiple workers from grabbing the same job.
 */
async function claimPromptJob(): Promise<string | null> {
  return prisma.$transaction(async (tx) => {
    const job = await tx.promptGenerationJob.findFirst({
      where: { status: "pending", attempts: { lt: 3 } },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!job) return null;

    // Atomically claim it — only succeeds if still pending
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
      where: { status: "pending", attempts: { lt: 3 } },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!job) return null;

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

  // Recovery on startup
  await recoverStaleRunning();

  let lastRecovery = Date.now();

  const timer = setInterval(async () => {
    // Periodic stale recovery (every 30s)
    if (Date.now() - lastRecovery > 30000) {
      await recoverStaleRunning();
      lastRecovery = Date.now();
    }

    // Try prompt first, then article
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
      return; // One job per poll
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
