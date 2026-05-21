/**
 * Phase 21: Production preflight check.
 *
 * Usage:
 *   npm run preflight:prod
 *
 * Checks:
 * 1. DATABASE_URL exists and can connect
 * 2. JWT_SECRET exists, is not the default, length >= 32
 * 3. If AI_PROVIDER=openai-compatible, checks API_BASE_URL, API_KEY, MODEL
 * 4. Prisma client can be initialized
 *
 * Does NOT call real AI (no cost).
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client.js";

let errors = 0;

function warn(msg: string) {
  console.log(`⚠️  ${msg}`);
}

function fail(msg: string) {
  console.error(`❌ ${msg}`);
  errors++;
}

function ok(msg: string) {
  console.log(`✅ ${msg}`);
}

async function main() {
  console.log("预生产环境检查\n");

  // 1. DATABASE_URL
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    fail("DATABASE_URL 未设置");
  } else if (dbUrl.includes("localhost:512") || dbUrl.includes("localhost:513")) {
    warn("DATABASE_URL 指向 Prisma dev 动态端口（512xx-513xx）。生产必须使用独立 PostgreSQL。");
  } else {
    ok("DATABASE_URL 已配置");
  }

  // 2. JWT_SECRET
  const jwt = process.env.JWT_SECRET;
  if (!jwt) {
    fail("JWT_SECRET 未设置");
  } else if (jwt === "change-me-in-production" || jwt === "change-me-in-production-MUST-use-strong-random-string") {
    fail("JWT_SECRET 为默认值，生产必须更换为强随机字符串");
  } else if (jwt.length < 32) {
    warn(`JWT_SECRET 长度过短 (${jwt.length} 字符)，建议 ≥ 32`);
  } else {
    ok("JWT_SECRET 已配置，长度足够");
  }

  // 3. AI provider
  const aiProvider = process.env.AI_PROVIDER ?? "mock";
  if (aiProvider === "mock") {
    warn("AI_PROVIDER=mock，真实 AI 未启用。提示词/文章生成将返回 mock 数据。");
  } else if (aiProvider === "openai-compatible") {
    const baseUrl = process.env.AI_BASE_URL;
    const apiKey = process.env.AI_API_KEY;
    const model = process.env.AI_MODEL;

    if (!baseUrl) fail("AI_BASE_URL 未设置");
    else ok("AI_BASE_URL 已设置");

    if (!apiKey) fail("AI_API_KEY 未设置");
    else if (apiKey.length < 20) fail("AI_API_KEY 过短，可能无效");
    else ok("AI_API_KEY 已设置（未打印值）");

    if (!model) fail("AI_MODEL 未设置");
    else ok(`AI_MODEL=${model}`);
  } else {
    warn(`未知的 AI_PROVIDER: ${aiProvider}`);
  }

  // 4. Database connectivity
  if (dbUrl) {
    try {
      const adapter = new PrismaPg({ connectionString: dbUrl });
      const prisma = new PrismaClient({ adapter });
      await prisma.$queryRaw`SELECT 1`;
      ok("数据库连接正常");
      await prisma.$disconnect();
    } catch (e) {
      fail(`数据库连接失败: ${(e as Error).message}`);
    }
  }

  // Summary
  console.log(`\n检查完成: ${errors > 0 ? `❌ ${errors} 项失败` : "✅ 全部通过"}`);
  process.exit(errors > 0 ? 1 : 0);
}

main();
