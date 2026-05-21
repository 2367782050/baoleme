/**
 * Phase 22: Local trial environment check.
 *
 * Usage:
 *   npm run trial:check
 *
 * Checks Node version, .env, DB connection, Prisma client, health endpoint.
 * Does NOT modify the database or start any servers.
 */

import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";

let errors = 0;

function warn(msg: string) { console.log(`⚠️  ${msg}`); }
function fail(msg: string) { console.error(`❌ ${msg}`); errors++; }
function ok(msg: string) { console.log(`✅ ${msg}`); }

async function main() {
  console.log("试用环境检查\n");

  // 1. Node version
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.slice(1).split(".")[0], 10);
  if (major >= 20) ok(`Node.js ${nodeVersion}`);
  else fail(`Node.js ${nodeVersion} — 需要 v20 或以上`);

  // 2. npm install
  if (existsSync("node_modules/next/package.json")) ok("依赖已安装 (next)");
  else fail("依赖未安装，请先运行 npm install");

  if (existsSync("node_modules/prisma/package.json")) ok("依赖已安装 (prisma)");
  else fail("依赖未安装，请先运行 npm install");

  // 3. .env exists
  if (existsSync(".env")) {
    ok(".env 文件存在");
    // Check content (don't print values)
    const envContent = readFileSync(".env", "utf-8");
    const hasDb = envContent.includes("DATABASE_URL");
    const hasJwt = envContent.includes("JWT_SECRET");
    if (hasDb) ok("DATABASE_URL 已配置"); else fail("DATABASE_URL 未在 .env 中配置");
    if (hasJwt) {
      const jwtMatch = envContent.match(/JWT_SECRET\s*=\s*"?([^"\n]+)"?/);
      if (jwtMatch && (jwtMatch[1] === "change-me-in-production" || jwtMatch[1].includes("change-me"))) {
        warn("JWT_SECRET 为默认值，生产环境请更换");
      } else {
        ok("JWT_SECRET 已配置");
      }
    } else {
      warn("JWT_SECRET 未在 .env 中配置（本地开发可用默认值）");
    }
  } else {
    fail(".env 文件不存在，请运行: cp .env.example .env 并配置");
  }

  // 4. Database connection
  if (process.env.DATABASE_URL) {
    try {
      const { PrismaClient } = await import("../lib/generated/prisma/client.js");
      const { PrismaPg } = await import("@prisma/adapter-pg");
      const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
      await prisma.$queryRaw`SELECT 1`;
      ok("数据库连接正常");
      await prisma.$disconnect();
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("ECONNREFUSED")) fail("数据库连接被拒绝，请检查 DATABASE_URL 和数据库是否运行");
      else if (msg.includes("does not exist") || msg.includes("does not exist")) fail("数据库不存在，请运行 npx prisma db push");
      else fail(`数据库连接失败: ${msg}`);
    }
  }

  // 5. Prisma client
  if (existsSync("lib/generated/prisma/client.ts") || existsSync("node_modules/.prisma/client/index.js")) ok("Prisma client 已生成");
  else fail("Prisma client 未生成，请运行 npm run db:generate");

  // 6. Health endpoint (if dev server is running)
  try {
    const res = await fetch("http://localhost:3000/api/health", { signal: AbortSignal.timeout(3000) });
    if (res.ok) ok("开发服务器运行中 (http://localhost:3000)");
    else fail(`开发服务器返回 ${res.status}`);
  } catch {
    warn("开发服务器未运行（这是正常的，检查结束后请运行 npm run trial:start）");
  }

  // 7. Worker tip
  warn("提示: AI 任务需要 worker 进程。请确保运行 npm run worker:ai 或使用 npm run trial:start 一并启动。");

  // Summary
  console.log(`\n检查完成: ${errors > 0 ? `❌ ${errors} 项失败` : "✅ 全部通过"}`);
  if (errors > 0) {
    console.log("请修复上述问题后重新运行 npm run trial:check");
  } else {
    console.log("环境就绪，可以运行 npm run trial:start 启动试用。");
  }
  process.exit(errors > 0 ? 1 : 0);
}

main();
