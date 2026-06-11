/**
 * Phase 15D screenshot script.
 * Logs in as admin, navigates to each page, waits for real content, captures screenshots.
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const PAGES = [
  { path: "/dashboard", selector: "text=你好，admin", file: "screenshots/dashboard.png" },
  { path: "/materials", selector: "text=爆款素材", file: "screenshots/materials.png" },
  { path: "/writing", selector: "text=文章生产管理台", file: "screenshots/writing.png" },
  { path: "/admin", selector: "text=后台运营", file: "screenshots/admin.png" },
] as const;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Login
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#account", "admin");
  await page.fill("#password", "admin123");
  await page.click("button[type=submit]");
  await page.waitForURL("**/dashboard", { timeout: 15000 });
  await page.waitForSelector("text=你好，admin", { timeout: 10000 });
  console.log("Logged in as admin");

  for (const { path, selector, file } of PAGES) {
    console.log(`Navigating to ${path}...`);
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });

    // Wait for the key content element to appear — fail if it doesn't
    try {
      await page.waitForSelector(selector, { timeout: 15000 });
    } catch {
      console.error(`FAIL: ${path} did not show "${selector}" — page is not rendering correctly.`);
      console.error("Page title:", await page.title());
      console.error("Page URL:", page.url());
      const body = await page.textContent("body");
      console.error("Body snippet:", body?.substring(0, 200));
      process.exit(1);
    }

    // Extra wait for async content to settle
    await page.waitForTimeout(1500);

    await page.screenshot({ path: file, fullPage: false });
    console.log(`  ✓ ${file}`);
  }

  await browser.close();
  console.log("\nAll screenshots captured successfully.");
}

main();
