/**
 * Phase 22: One-click trial environment launcher.
 *
 * Usage:
 *   npm run trial:start
 *
 * Does:
 * 1. Check .env, DB connection
 * 2. Auto db:generate + db push + db:seed
 * 3. Launch dev server + AI worker
 * 4. Print access info
 * 5. Ctrl+C stops both
 */

import "dotenv/config";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";

const AI_KEY = process.env.AI_API_KEY;
const AI_PROVIDER = process.env.AI_PROVIDER ?? "mock";

let devProcess: ChildProcess | null = null;
let workerProcess: ChildProcess | null = null;

function log(msg: string) { console.log(`  ${msg}`); }
function title(msg: string) { console.log(`\n🔹 ${msg}`); }

function cleanup() {
  console.log("\n正在停止服务...");
  if (devProcess) { devProcess.kill("SIGTERM"); log("Web 已停止"); }
  if (workerProcess) { workerProcess.kill("SIGTERM"); log("Worker 已停止"); }
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

async function main() {
  console.log("爆了么 — 试用环境启动\n");

  // 1. Check .env
  if (!existsSync(".env")) {
    console.error("❌ .env 文件不存在。请运行: cp .env.example .env 并配置。");
    process.exit(1);
  }
  log(".env 文件存在");

  // 2. Check DATABASE_URL
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL 未在 .env 中配置。");
    process.exit(1);
  }
  log("DATABASE_URL 已配置");

  // 3. Generate Prisma client
  title("生成 Prisma client");
  try {
    const { execSync } = await import("node:child_process");
    execSync("npm run db:generate", { stdio: "pipe" });
    log("Prisma client 已生成");
  } catch {
    console.error("❌ Prisma client 生成失败。请手动运行 npm run db:generate");
    process.exit(1);
  }

  // 4. Push schema
  title("同步数据库 schema");
  try {
    const { execSync } = await import("node:child_process");
    execSync("npx prisma db push --accept-data-loss", { stdio: "pipe" });
    log("Schema 已同步");
  } catch {
    console.error("❌ Schema 同步失败。请检查 DATABASE_URL 和数据库是否运行。");
    process.exit(1);
  }

  // 5. Seed
  title("导入种子数据");
  try {
    const { execSync } = await import("node:child_process");
    execSync("npm run db:seed", { stdio: "pipe" });
    log("种子数据已导入");
  } catch {
    console.error("❌ 种子数据导入失败（可能已存在，继续启动...）");
  }

  // 6. Start dev server
  title("启动 Web 服务");
  devProcess = spawn("npx", ["next", "dev", "--port", "3000"], {
    stdio: "pipe",
    shell: true,
    env: { ...process.env },
  });
  devProcess.stdout?.on("data", (d: Buffer) => { if (d.toString().includes("Ready")) log("Web 已就绪: http://localhost:3000"); });
  devProcess.stderr?.on("data", (d: Buffer) => {
    const msg = d.toString();
    if (msg.includes("address already in use") || msg.includes("EADDRINUSE")) {
      console.error("❌ 端口 3000 被占用。请先关闭占用进程，或修改端口。");
      cleanup();
    }
  });

  // Wait for server to be ready
  await new Promise(r => setTimeout(r, 5000));

  // 7. Start AI worker
  title("启动 AI Worker");
  workerProcess = spawn("npx", ["tsx", "scripts/ai-worker.ts"], {
    stdio: "pipe",
    shell: true,
    env: { ...process.env },
  });
  workerProcess.stdout?.on("data", (d: Buffer) => { if (d.toString().includes("started")) log("Worker 已启动"); });

  await new Promise(r => setTimeout(r, 2000));

  // 8. Print info
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  🎉 爆了么试用环境已启动！");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  访问地址:  http://localhost:3000`);
  console.log(`  管理员账号: admin / admin123`);
  console.log(`  AI Provider: ${AI_PROVIDER}`);
  if (AI_PROVIDER !== "mock" && AI_KEY) {
    console.log(`  AI API Key:  ${AI_KEY.substring(0, 6)}...（已配置）`);
  } else if (AI_PROVIDER !== "mock") {
    console.log(`  ⚠️  AI_API_KEY 未配置，AI 将使用 Mock 模式`);
  }
  console.log("  ── Mock 边界 ──");
  console.log("  支付: 模拟支付（不产生真实交易）");
  console.log("  公众号: 模拟授权（未连接微信开放平台）");
  console.log("  提现: 模拟审核（不执行真实打款）");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  按 Ctrl+C 停止所有服务\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
