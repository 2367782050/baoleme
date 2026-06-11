/**
 * Phase 24: Content ingestion worker.
 * Polls enabled content sources on a configurable interval
 * and imports new articles into the database.
 *
 * Usage: tsx scripts/content-worker.ts
 *
 * Env vars:
 *   CONTENT_SOURCES: comma-separated list (e.g. "rss,newrank")
 *   CONTENT_WORKER_POLL_MS: polling interval in ms (default 900000 = 15 min)
 *   DATABASE_URL: PostgreSQL connection string
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client.js";
import {
  RSSContentSource,
  NewRankContentSource,
  ContentSourceManager,
} from "../lib/adapters/material/sources/index.js";
import {
  createIngestionRun,
  completeIngestionRun,
  failIngestionRun,
  recoverStaleIngestionRuns,
} from "../lib/services/content-ingestion.service.js";

const POLL_MS = parseInt(process.env.CONTENT_WORKER_POLL_MS ?? "900000", 10); // 15 min default
const STALE_MS = POLL_MS * 2; // runs stuck for > 2 cycles are stale

// Bootstrap Prisma
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Build manager and register sources
const manager = new ContentSourceManager();

const enabledSources = (process.env.CONTENT_SOURCES ?? "")
  .split(",")
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

if (enabledSources.includes("rss")) {
  manager.register(new RSSContentSource(true));
  console.log("[content-worker] RSS source registered");
}

if (enabledSources.includes("newrank")) {
  const newrankSource = new NewRankContentSource(
    !!process.env.NEWRANK_API_KEY,
  );
  if (newrankSource.isEnabled) {
    manager.register(newrankSource);
    console.log("[content-worker] NewRank source registered");
  } else {
    console.log("[content-worker] NewRank source skipped (no API key)");
  }
}

if (enabledSources.length === 0) {
  console.log("[content-worker] No content sources configured. Set CONTENT_SOURCES=rss to enable.");
  process.exit(0);
}

// Periodic stale recovery
let staleInterval: ReturnType<typeof setInterval> | null = null;

async function recoverStale() {
  try {
    const recovered = await recoverStaleIngestionRuns(STALE_MS);
    if (recovered > 0) {
      console.log(`[content-worker] Recovered ${recovered} stale ingestion run(s)`);
    }
  } catch (e) {
    console.error(`[content-worker] Stale recovery failed: ${(e as Error).message}`);
  }
}

// Main ingestion cycle
async function runIngestion() {
  const sources = manager.listSources();
  if (sources.length === 0) return;

  console.log(`[content-worker] Running ingestion for ${sources.length} source(s)...`);

  for (const source of sources) {
    console.log(`[content-worker] ── ${source.name} ──`);

    // Create run record
    const run = await createIngestionRun(source.name);

    try {
      const result = await manager.fetchSource(source.name);
      await completeIngestionRun(run.id, {
        articlesFound: result.articlesFound,
        articlesNew: result.articlesNew,
        articlesDuplicated: result.articlesDuplicated,
        errors: result.errors,
      });

      console.log(
        `[content-worker]   ${source.name}: ${result.articlesFound} found, ` +
        `${result.articlesNew} new, ${result.articlesDuplicated} dup`,
      );
      if (result.errors.length > 0) {
        console.warn(`[content-worker]   errors: ${result.errors.join("; ")}`);
      }

      // AI scoring for newly ingested articles (non-blocking)
      // TODO: Track which article IDs are new from this run
    } catch (e) {
      await failIngestionRun(run.id, (e as Error).message);
      console.error(`[content-worker]   ${source.name} FAILED: ${(e as Error).message}`);
    }
  }

  console.log("[content-worker] Ingestion cycle complete.");
}

// Main loop
console.log(`[content-worker] Starting. Poll interval: ${POLL_MS}ms. Sources: ${enabledSources.join(", ")}`);

// Run immediately on startup, then on interval
runIngestion();
const pollInterval = setInterval(runIngestion, POLL_MS);

// Stale recovery every 5 minutes
staleInterval = setInterval(recoverStale, 5 * 60 * 1000);

// Graceful shutdown
function shutdown(signal: string) {
  console.log(`[content-worker] Received ${signal}. Shutting down...`);
  clearInterval(pollInterval);
  if (staleInterval) clearInterval(staleInterval);
  prisma.$disconnect().then(() => {
    console.log("[content-worker] Disconnected. Goodbye.");
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
