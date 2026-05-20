/**
 * Phase 20: Database-persistent AI task worker.
 *
 * Polls pending prompt generation and article generation jobs from the DB,
 * executes them, and updates status/result. No Redis/BullMQ required.
 *
 * Usage:
 *   npm run worker:ai
 *
 * Config:
 *   AI_WORKER_POLL_MS — poll interval (default 2000ms)
 *   AI_WORKER_MAX_CONCURRENT — max concurrent jobs (default 1)
 */

import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  executeGenerationJob,
} from "../lib/services/prompt-generation.service.js";
import {
  executeArticleGenerationJob,
} from "../lib/services/article-generation.service.js";

const POLL_MS = parseInt(process.env.AI_WORKER_POLL_MS ?? "2000", 10);
const MAX_CONCURRENT = parseInt(process.env.AI_WORKER_MAX_CONCURRENT ?? "1", 10);

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

let running = 0;

async function processPromptJob() {
  const job = await prisma.promptGenerationJob.findFirst({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
  });
  if (!job) return false;

  running++;
  console.log(`[worker] Prompt job ${job.id.substring(0, 8)}... (attempt ${job.attempts + 1}/${job.maxAttempts})`);
  try {
    await executeGenerationJob(job.id);
    const updated = await prisma.promptGenerationJob.findUnique({ where: { id: job.id } });
    console.log(`[worker] Prompt job ${job.id.substring(0, 8)} → ${updated?.status}`);
  } catch (e) {
    console.error(`[worker] Prompt job ${job.id.substring(0, 8)} error:`, (e as Error).message);
  } finally {
    running--;
  }
  return true;
}

async function processArticleJob() {
  const job = await prisma.articleGenerationJob.findFirst({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
  });
  if (!job) return false;

  running++;
  console.log(`[worker] Article job ${job.id.substring(0, 8)}... (attempt ${job.attempts + 1}/${job.maxAttempts})`);
  try {
    await executeArticleGenerationJob(job.id);
    const updated = await prisma.articleGenerationJob.findUnique({ where: { id: job.id } });
    console.log(`[worker] Article job ${job.id.substring(0, 8)} → ${updated?.status}`);
  } catch (e) {
    console.error(`[worker] Article job ${job.id.substring(0, 8)} error:`, (e as Error).message);
  } finally {
    running--;
  }
  return true;
}

async function main() {
  console.log(`[worker] AI worker started. Poll: ${POLL_MS}ms, Max concurrent: ${MAX_CONCURRENT}`);
  console.log(`[worker] Press Ctrl+C to stop.`);

  const timer = setInterval(async () => {
    if (running >= MAX_CONCURRENT) return;

    // Try prompt jobs first, then article jobs
    const didPrompt = await processPromptJob();
    if (!didPrompt) await processArticleJob();
  }, POLL_MS);

  process.on("SIGINT", () => { clearInterval(timer); prisma.$disconnect(); process.exit(0); });
  process.on("SIGTERM", () => { clearInterval(timer); prisma.$disconnect(); process.exit(0); });
}

main();
