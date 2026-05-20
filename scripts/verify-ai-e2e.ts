/**
 * Phase 19C: Real AI browser acceptance test.
 *
 * Usage:
 *   npm run verify:ai:e2e
 *
 * This script is intentionally NOT part of CI. It calls the configured real AI
 * provider through the browser UI and may consume paid API quota.
 */

import "dotenv/config";

import { spawn, type ChildProcess } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium, type Page } from "playwright";
import { OpenAICompatibleProvider } from "../lib/adapters/ai/openai-provider.js";

const BASE = process.env.AI_E2E_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const ADMIN_ACCOUNT = process.env.AI_E2E_ADMIN_ACCOUNT ?? "admin";
const ADMIN_PASSWORD = process.env.AI_E2E_ADMIN_PASSWORD ?? "admin123";
const TIMEOUT_MS = Number(process.env.AI_E2E_TIMEOUT_MS ?? 120000);

type BrowserError = { url: string; type: string; text: string };

function hasRealAIConfig() {
  const provider = (process.env.AI_PROVIDER ?? "mock").toLowerCase();
  return Boolean(
    provider === "openai-compatible" &&
    process.env.AI_BASE_URL &&
    process.env.AI_API_KEY &&
    process.env.AI_MODEL,
  );
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function healthOk() {
  try {
    const res = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return false;
    const body = await res.json() as { ok?: boolean; database?: string };
    return Boolean(body.ok && body.database === "ok");
  } catch {
    return false;
  }
}

function startDevServer() {
  const child = spawn("npm", ["run", "dev"], {
    cwd: process.cwd(),
    env: { ...process.env },
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout?.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    if (/ready|local|localhost/i.test(text)) process.stdout.write(text);
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    if (!/warn/i.test(text)) process.stderr.write(text);
  });

  return child;
}

function basePort() {
  const url = new URL(BASE);
  if (url.port) return Number(url.port);
  return url.protocol === "https:" ? 443 : 80;
}

async function stopPort(port: number) {
  if (port === 80 || port === 443) return;

  const command: [string, string[]] = process.platform === "win32"
    ? ["powershell.exe", [
      "-NoProfile",
      "-Command",
      `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }`,
    ]]
    : ["sh", ["-lc", `if command -v lsof >/dev/null 2>&1; then lsof -ti tcp:${port} | xargs -r kill -9; fi`]];

  await new Promise((resolve) => {
    const child = spawn(command[0], command[1], { stdio: "ignore" });
    child.on("exit", resolve);
    child.on("error", resolve);
  });
}

async function ensureAppServer() {
  if (await healthOk()) return null;

  console.log(`未检测到可用应用服务，正在启动 npm run dev (${BASE}) ...`);
  const child = startDevServer();

  for (let i = 0; i < 60; i += 1) {
    if (await healthOk()) return child;
    await sleep(1000);
  }

  child.kill();
  throw new Error("应用服务或数据库未就绪，请先确认 PostgreSQL 可用并完成 db:seed。");
}

async function login(page: Page) {
  const res = await page.context().request.post(`${BASE}/api/auth/login`, {
    data: { account: ADMIN_ACCOUNT, password: ADMIN_PASSWORD },
  });
  const body = await res.json() as { success?: boolean; error?: { message?: string } };
  if (!res.ok() || !body.success) {
    throw new Error(`管理员登录失败: ${body.error?.message ?? res.statusText()}`);
  }

  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.getByText(`你好，${ADMIN_ACCOUNT}`).waitFor({ state: "visible", timeout: 10000 });
}

async function verifyPromptFlow(page: Page) {
  const suffix = Date.now().toString(36);
  const groupName = `真AI分组_${suffix}`;
  const promptName = `真AI提示词_${suffix}`;

  console.log("1/3 浏览器提示词生成...");
  await page.goto(`${BASE}/prompts`, { waitUntil: "networkidle" });
  await page.getByText("全部提示词").waitFor({ state: "visible", timeout: 10000 });

  await page.getByRole("button", { name: "+ 新建" }).click();
  await page.locator("input[placeholder='分组名称']").fill(groupName);
  const groupResponsePromise = page.waitForResponse((response) =>
    response.url().includes("/api/prompts/groups") &&
    response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "确定" }).click();
  const groupResponse = await groupResponsePromise;
  const groupBody = await groupResponse.json() as { success?: boolean; error?: { message?: string } };
  if (!groupResponse.ok() || !groupBody.success) {
    throw new Error(`提示词分组创建失败: ${groupBody.error?.message ?? groupResponse.statusText()}`);
  }

  await page.goto(`${BASE}/prompts`, { waitUntil: "networkidle" });

  await page.getByRole("button", { name: "生成提示词" }).click();
  const nameInput = page.locator("input[placeholder='如：财经爆款提示词']").first();
  await nameInput.waitFor({ state: "visible", timeout: 10000 });
  await nameInput.fill(promptName);
  await page.locator("input[type='number']").first().fill("900");
  await page.locator("select").last().selectOption({ label: groupName }).catch(() => {});

  const responsePromise = page.waitForResponse((response) =>
    response.url().includes("/api/prompts/generate") &&
    response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "开始生成" }).click();
  const response = await responsePromise;
  const body = await response.json() as { success?: boolean; data?: { jobId?: string }; error?: { message?: string } };
  if (!response.ok() || !body.success || !body.data?.jobId) {
    throw new Error(`提示词生成请求失败: ${body.error?.message ?? response.statusText()}`);
  }

  const prompt = await waitForPromptCompleted(page, body.data.jobId);
  await page.goto(`${BASE}/prompts`, { waitUntil: "networkidle" });
  await page.getByText(prompt.name).first().waitFor({ state: "visible", timeout: 15000 });
  await page.screenshot({ path: "screenshots/prompts-ai-real.png", fullPage: false });
  console.log(`   ✅ 提示词已生成并出现在列表: ${prompt.name}`);
}

async function waitForPromptCompleted(page: Page, jobId: string) {
  const started = Date.now();
  let lastStatus = "";

  while (Date.now() - started < TIMEOUT_MS) {
    const cookie = (await page.context().cookies(BASE)).map((c) => `${c.name}=${c.value}`).join("; ");
    const res = await fetch(`${BASE}/api/prompts/generation-jobs/${jobId}`, { headers: { Cookie: cookie } });
    if (res.ok) {
      const body = await res.json() as {
        success?: boolean;
        data?: { status?: string; outputPromptId?: string; errorMessage?: string };
      };
      if (body.success && body.data) {
        lastStatus = body.data.status ?? "";
        if (body.data.status === "failed") {
          throw new Error(`提示词任务失败: ${body.data.errorMessage ?? "未知错误"}`);
        }
        if (body.data.status === "completed" && body.data.outputPromptId) {
          const promptsRes = await fetch(`${BASE}/api/prompts`, { headers: { Cookie: cookie } });
          const promptsBody = await promptsRes.json() as {
            success?: boolean;
            data?: Array<{ id: string; name: string; content: string }>;
          };
          const prompt = promptsBody.data?.find((item) => item.id === body.data?.outputPromptId);
          if (promptsBody.success && prompt?.content && prompt.content.length > 30) {
            return { id: prompt.id, name: prompt.name };
          }
        }
      }
    }
    await sleep(1000);
  }

  throw new Error(`提示词任务未在 ${TIMEOUT_MS}ms 内完成，最后状态: ${lastStatus || "未知"}`);
}

async function verifyArticleFlow(page: Page) {
  const suffix = Date.now().toString(36);
  const title = `真AI文章_${suffix}_2026年AI创作趋势`;

  console.log("2/3 浏览器文章生成...");
  await page.goto(`${BASE}/writing`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "智能创作" }).waitFor({ state: "visible", timeout: 10000 });

  await page.getByRole("button", { name: "开始创作" }).click();
  await page.locator("input[placeholder='输入您想创作的主题...']").fill(title);
  await page.locator("textarea").last().fill("请围绕 AI 创作工具、内容生产效率、普通创作者机会三个角度写作，语言自然，适合公众号读者。");

  const responsePromise = page.waitForResponse((response) =>
    response.url().includes("/api/articles/generate") &&
    response.request().method() === "POST",
  );
  await page.locator(".depth-drawer").getByRole("button", { name: "开始创作" }).click();
  const response = await responsePromise;
  const body = await response.json() as { success?: boolean; data?: { articleId?: string }; error?: { message?: string } };
  if (!response.ok() || !body.success || !body.data?.articleId) {
    throw new Error(`文章生成请求失败: ${body.error?.message ?? response.statusText()}`);
  }

  const article = await waitForArticleCompleted(page, body.data.articleId);
  await page.goto(`${BASE}/writing`, { waitUntil: "networkidle" });
  const row = page.locator(`[data-testid='article-row-${body.data.articleId}']`);
  await row.waitFor({ state: "visible", timeout: 15000 });
  await page.screenshot({ path: "screenshots/writing-ai-real.png", fullPage: false });
  console.log(`   ✅ 文章已生成并出现在列表: ${article.title}`);
}

async function waitForArticleCompleted(page: Page, articleId: string) {
  const started = Date.now();
  let lastStatus = "";

  while (Date.now() - started < TIMEOUT_MS) {
    const cookie = (await page.context().cookies(BASE)).map((c) => `${c.name}=${c.value}`).join("; ");
    const res = await fetch(`${BASE}/api/articles/${articleId}`, { headers: { Cookie: cookie } });
    if (res.ok) {
      const body = await res.json() as {
        success?: boolean;
        data?: { title?: string; status?: string; markdownContent?: string };
      };
      if (body.success && body.data) {
        lastStatus = body.data.status ?? "";
        if (body.data.status === "completed" && body.data.markdownContent && body.data.markdownContent.length > 30) {
          return { title: body.data.title ?? articleId };
        }
        if (body.data.status === "failed") {
          throw new Error("文章任务失败，请检查 AI 调用错误日志。");
        }
      }
    }
    await sleep(1500);
  }

  throw new Error(`文章任务未在 ${TIMEOUT_MS}ms 内完成，最后状态: ${lastStatus || "未知"}`);
}

async function verifyChineseFailurePath() {
  console.log("3/3 错误 Key 中文错误验收...");
  const provider = new OpenAICompatibleProvider({
    baseUrl: process.env.AI_BASE_URL!,
    apiKey: "sk-invalid-ai-e2e-key",
    model: process.env.AI_MODEL!,
    timeoutMs: 10000,
  });

  try {
    await provider.generatePrompt({
      name: "错误路径验收",
      contentDomain: "财经",
      targetAudience: "职场人士",
      authorName: "验收",
      personaDetails: "验收",
      personalityTraits: ["理性"],
      headingStyle: "numbered",
      wordCount: 500,
      enableAIDetectionEvasion: true,
      materialAnalysisJson: "{}",
      userNotes: "这次调用应因错误 Key 失败",
    });
  } catch (e) {
    const message = (e as Error).message;
    if (!message.includes("AI 认证失败")) {
      throw new Error(`错误路径未返回预期中文认证错误，实际为: ${message}`);
    }
    console.log(`   ✅ 错误路径返回中文错误: ${message}`);
    return;
  }

  throw new Error("错误 Key 调用没有失败，错误路径验收无效。");
}

function attachErrorCapture(page: Page, errors: BrowserError[], currentUrlRef: { value: string }) {
  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "error" && !text.includes("Failed to load resource: 401 (Unauthorized)")) {
      errors.push({ url: currentUrlRef.value, type: "console.error", text });
    }
  });
  page.on("pageerror", (err) => {
    errors.push({ url: currentUrlRef.value, type: "pageerror", text: err.message });
  });
  page.on("requestfailed", (req) => {
    const failure = req.failure();
    if (failure?.errorText && failure.errorText !== "net::ERR_ABORTED") {
      errors.push({ url: currentUrlRef.value, type: "requestfailed", text: `${req.url()} - ${failure.errorText}` });
    }
  });
  page.on("response", (resp) => {
    if (resp.status() >= 500) {
      errors.push({ url: currentUrlRef.value, type: `response ${resp.status()}`, text: resp.url() });
    }
  });
}

async function main() {
  if (!hasRealAIConfig()) {
    console.log("当前未配置真实 AI，跳过浏览器端真实 AI 闭环验收。");
    console.log("如需验收，请设置 AI_PROVIDER=openai-compatible、AI_BASE_URL、AI_API_KEY、AI_MODEL。");
    process.exit(0);
  }

  console.log(`真实 AI 浏览器验收: model=${process.env.AI_MODEL}, base=${process.env.AI_BASE_URL}`);
  await mkdir("screenshots", { recursive: true });

  let devServer: ChildProcess | null = null;
  const errors: BrowserError[] = [];
  const currentUrlRef = { value: "" };

  try {
    devServer = await ensureAppServer();
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    attachErrorCapture(page, errors, currentUrlRef);

    currentUrlRef.value = "/login";
    await login(page);

    currentUrlRef.value = "/prompts";
    await verifyPromptFlow(page);

    currentUrlRef.value = "/writing";
    await verifyArticleFlow(page);

    await browser.close();
    await verifyChineseFailurePath();

    if (errors.length > 0) {
      console.error("\n浏览器验收捕获到错误:");
      for (const err of errors) console.error(`- [${err.type}] ${err.url}: ${err.text}`);
      process.exit(1);
    }

    console.log("\n🎉 浏览器端真实 AI 闭环验收通过。");
    console.log("截图已生成:");
    console.log("  screenshots/prompts-ai-real.png");
    console.log("  screenshots/writing-ai-real.png");
  } finally {
    if (devServer) {
      devServer.kill();
      await stopPort(basePort());
    }
  }
}

main().catch((e) => {
  console.error("❌ 浏览器端真实 AI 闭环验收失败:", (e as Error).message);
  process.exit(1);
});
