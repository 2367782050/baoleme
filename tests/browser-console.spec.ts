/**
 * Phase 14B: Enhanced console error test.
 * Registers ALL error listeners before ANY navigation.
 * Covers unauthenticated + authenticated + interaction pages.
 */
import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";

test.describe("Console errors across all pages", () => {
  test("no console errors on unauthenticated pages", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    page.on("pageerror", (err) => errors.push(err.message));

    for (const path of ["/", "/login", "/register"]) {
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(500);
    }

    const relevant = errors.filter(e => !e.includes("hydration")); // ignore Next.js hydration warnings
    expect(relevant).toHaveLength(0);
  });

  test("no console errors on authenticated pages + interactions", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("requestfailed", (req) => {
      const f = req.failure();
      if (f && f.errorText !== "net::ERR_ABORTED") {
        errors.push(`requestfailed: ${req.url()} - ${f.errorText}`);
      }
    });
    page.on("response", (resp) => {
      if (resp.status() >= 400 && resp.status() !== 307) {
        errors.push(`HTTP ${resp.status()}: ${resp.url()}`);
      }
    });

    // Login
    await page.goto(`${BASE}/login`);
    await page.fill("#account", "admin");
    await page.fill("#password", "admin123");
    await page.click("button[type=submit]");
    await page.waitForURL("**/dashboard", { timeout: 10000 });

    const authenticatedPages = [
      "/dashboard", "/materials", "/prompts", "/writing",
      "/formatter", "/official-accounts", "/membership", "/referral", "/admin",
    ];

    for (const path of authenticatedPages) {
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(800);
    }

    // Interactions
    await page.goto(`${BASE}/materials`, { waitUntil: "networkidle" });
    await page.locator("button:has-text('热搜榜')").click().catch(() => {});
    await page.waitForTimeout(300);

    await page.goto(`${BASE}/formatter`, { waitUntil: "networkidle" });
    const ed = page.locator("textarea").first();
    if (await ed.isVisible({ timeout: 2000 }).catch(() => false)) {
      await ed.fill("# Test");
      await page.locator("button:has-text('预览')").click().catch(() => {});
      await page.waitForTimeout(300);
    }

    await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
    for (const t of ["用户管理", "AI 任务"]) {
      await page.locator(`button:has-text('${t}')`).click().catch(() => {});
      await page.waitForTimeout(300);
    }

    const relevant = errors.filter(e =>
      !e.includes("hydration") &&
      !e.includes("net::ERR_ABORTED")
    );
    expect(relevant).toHaveLength(0);
  });
});
