/**
 * Phase 14B: console error capture script (fixed).
 * ALL listeners registered BEFORE any navigation.
 * Covers 12 pages + key interactions.
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors: { url: string; type: string; text: string }[] = [];
  let currentUrl = "";

  // Register ALL listeners BEFORE any navigation
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push({ url: currentUrl, type: "console.error", text: msg.text() });
    }
  });
  page.on("pageerror", (err) => {
    errors.push({ url: currentUrl, type: "pageerror", text: err.message });
  });
  page.on("requestfailed", (req) => {
    const f = req.failure();
    if (f && f.errorText !== "net::ERR_ABORTED") {
      errors.push({ url: currentUrl, type: "requestfailed", text: req.url() + " - " + f.errorText });
    }
  });
  page.on("response", (resp) => {
    if (resp.status() >= 400 && resp.status() !== 307) {
      errors.push({ url: currentUrl, type: "response " + resp.status(), text: resp.url() });
    }
  });

  async function visit(path: string) {
    currentUrl = path;
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(800);
  }

  // Unauthenticated
  await visit("/");
  await visit("/login");
  await visit("/register");

  // Login
  currentUrl = "/login";
  await page.goto(`${BASE}/login`);
  await page.fill("#account", "admin");
  await page.fill("#password", "admin123");
  await page.click("button[type=submit]");
  await page.waitForURL("**/dashboard", { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1000);

  // Authenticated pages + interactions
  await visit("/dashboard");
  await visit("/materials");
  currentUrl = "/materials";
  await page.locator("button:has-text('热搜榜')").click().catch(() => {});
  await page.waitForTimeout(400);
  await page.locator("button:has-text('如何找对标')").click().catch(() => {});
  await page.waitForTimeout(400);

  await visit("/prompts");
  currentUrl = "/prompts";
  await page.locator("button:has-text('生成提示词')").click().catch(() => {});
  await page.waitForTimeout(400);

  await visit("/writing");
  currentUrl = "/writing";
  await page.locator("button:has-text('开始创作')").click().catch(() => {});
  await page.waitForTimeout(400);

  await visit("/formatter");
  currentUrl = "/formatter";
  const ed = page.locator("textarea").first();
  if (await ed.isVisible({ timeout: 2000 }).catch(() => false)) {
    await ed.fill("# Test\n\nHello");
    await page.locator("button:has-text('预览')").click().catch(() => {});
    await page.waitForTimeout(400);
  }

  await visit("/official-accounts");
  currentUrl = "/official-accounts";
  const oaInp = page.locator("input[placeholder='公众号名称']");
  if (await oaInp.isVisible({ timeout: 2000 }).catch(() => false)) {
    await oaInp.fill(`ctest_${Date.now()}`);
    await page.locator("button[type=submit]").click().catch(() => {});
    await page.waitForTimeout(600);
  }
  const delBtn = page.locator("button:has-text('删除')").first();
  if (await delBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    page.once("dialog", async (d) => { await d.accept(); });
    await delBtn.click();
    await page.waitForTimeout(600);
  }

  await visit("/membership");
  currentUrl = "/membership";
  const buyBtn = page.locator("button:has-text('开通')").first();
  if (await buyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    page.once("dialog", async (d) => { await d.accept(); });
    await buyBtn.click();
    await page.waitForTimeout(800);
  }

  await visit("/referral");
  currentUrl = "/referral";
  await page.locator("button:has-text('提现记录')").click().catch(() => {});
  await page.waitForTimeout(400);

  await visit("/admin");
  currentUrl = "/admin";
  for (const t of ["用户管理", "会员管理", "订单管理", "提现审核", "AI 任务"]) {
    await page.locator(`button:has-text('${t}')`).click().catch(() => {});
    await page.waitForTimeout(300);
  }

  await browser.close();

  // Report
  if (errors.length === 0) {
    console.log("No errors found across 12 pages + interactions.");
  } else {
    console.log(`\n${errors.length} errors found:\n`);
    const groups = new Map<string, typeof errors>();
    for (const e of errors) { const a = groups.get(e.type) || []; a.push(e); groups.set(e.type, a); }
    for (const [type, list] of groups) {
      console.log(`\n[${type}] (${list.length}):`);
      for (const e of list) console.log(`  ${e.url}: ${e.text.substring(0, 200)}`);
    }
  }
}

main();
