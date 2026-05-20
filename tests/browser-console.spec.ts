/**
 * Phase 15D: Console error test — no hiding real errors.
 *
 * Filtering rules:
 * - ALLOW: hydration dev warnings, net::ERR_ABORTED
 * - ALLOW: console.error "401 (Unauthorized)" (untraceable to URL; response-level
 *   filter below catches real issues)
 * - ALLOW on response: 401 on /api/auth/me (Header server component)
 * - FAIL: any HTTP 500, 403, 404, non-/api/auth/me 401 on response
 * - FAIL: any pageerror (uncaught exception in JS)
 * - FAIL: any requestfailed (other than ERR_ABORTED)
 */
import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";

test.describe("Console errors across all pages", () => {
  test("no console errors on unauthenticated pages", async ({ page }) => {
    const errors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const text = msg.text();
      // Generic "401 (Unauthorized)" console error — cannot tell which URL.
      // The response listener below catches specific non-/api/auth/me 401s.
      if (text.includes("401") && text.includes("Unauthorized")) return;
      errors.push(text);
    });
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("response", (resp) => {
      if (resp.status() === 401 && resp.url().includes("/api/auth/me")) return;
      if (resp.status() >= 400 && resp.status() !== 307) {
        errors.push(`HTTP ${resp.status()}: ${resp.url()}`);
      }
    });

    for (const path of ["/", "/login", "/register"]) {
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(500);
    }

    const relevant = errors.filter(e =>
      !e.includes("hydration") &&
      !e.includes("net::ERR_ABORTED")
    );
    expect(relevant).toHaveLength(0);
  });

  test("no console errors on authenticated pages + interactions", async ({ page }) => {
    const errors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const text = msg.text();
      // Generic "401 (Unauthorized)" console error — cannot tell which URL.
      // The response listener below catches specific non-/api/auth/me 401s.
      if (text.includes("401") && text.includes("Unauthorized")) return;
      errors.push(text);
    });
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("requestfailed", (req) => {
      const f = req.failure();
      if (f && f.errorText !== "net::ERR_ABORTED") {
        errors.push(`requestfailed: ${req.url()} - ${f.errorText}`);
      }
    });
    page.on("response", (resp) => {
      if (resp.status() === 401 && resp.url().includes("/api/auth/me")) return;
      if (resp.status() >= 400 && resp.status() !== 307) {
        errors.push(`HTTP ${resp.status()}: ${resp.url()}`);
      }
    });

    // Login
    await page.goto(`${BASE}/login`);
    await page.fill("#account", "admin");
    await page.fill("#password", "admin123");
    await page.getByRole("button", { name: "登录", exact: true }).click();
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
