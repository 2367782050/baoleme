/**
 * Phase 14B: Auth navigation tests.
 * Verifies: login state in Header, back button doesn't land on /login form, guard redirect.
 */
import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";

test.describe("Auth navigation", () => {
  test("after login, Header shows logged-in state, not 登录/注册", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill("#account", "admin");
    await page.fill("#password", "admin123");
    await page.click("button[type=submit]");
    // window.location.replace triggers full navigation
    await page.waitForURL("**/dashboard", { timeout: 10000 });

    // Header must NOT show 登录/注册 links
    await expect(page.getByText("你好，admin")).toBeVisible({ timeout: 5000 });

    // Header nav should show workbench/materials/prompts etc.
    const header = page.locator("header");
    await expect(header.getByText("工作台")).toBeVisible({ timeout: 3000 });
    await expect(header.getByText("爆款素材")).toBeVisible({ timeout: 3000 });

    // Must NOT show standalone 登录/注册 links
    const headerText = await header.textContent();
    expect(headerText).not.toMatch(/\b登录\b.*\b注册\b/);
  });

  test("back button after login does NOT land on /login form", async ({ page }) => {
    // Login
    await page.goto(`${BASE}/login`);
    await page.fill("#account", "admin");
    await page.fill("#password", "admin123");
    await page.click("button[type=submit]");
    await page.waitForURL("**/dashboard", { timeout: 10000 });

    // Navigate to another page
    await page.goto(`${BASE}/materials`);
    await page.waitForTimeout(500);

    // Go back
    await page.goBack();

    // Should NOT be on /login (because login used replace, not push)
    const url = page.url();
    expect(url).not.toContain("/login");
  });

  test("logged-in user visiting /login is redirected to /dashboard", async ({ page }) => {
    // Login first
    await page.goto(`${BASE}/login`);
    await page.fill("#account", "admin");
    await page.fill("#password", "admin123");
    await page.click("button[type=submit]");
    await page.waitForURL("**/dashboard", { timeout: 10000 });

    // Now visit /login directly
    await page.goto(`${BASE}/login`);
    await page.waitForTimeout(2000);

    // Should have been redirected to /dashboard
    const url = page.url();
    expect(url).toContain("/dashboard");
  });

  test("logged-in user visiting /register is redirected to /dashboard", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill("#account", "admin");
    await page.fill("#password", "admin123");
    await page.click("button[type=submit]");
    await page.waitForURL("**/dashboard", { timeout: 10000 });

    await page.goto(`${BASE}/register`);
    await page.waitForTimeout(2000);

    const url = page.url();
    expect(url).toContain("/dashboard");
  });

  test("logout restores Header to unauthenticated state", async ({ page }) => {
    // Login
    await page.goto(`${BASE}/login`);
    await page.fill("#account", "admin");
    await page.fill("#password", "admin123");
    await page.click("button[type=submit]");
    await page.waitForURL("**/dashboard", { timeout: 10000 });

    // Click logout
    await page.click("button:has-text('退出登录')");

    // Should end up on /login with unauthenticated Header
    await page.waitForURL("**/login", { timeout: 10000 });
    const header = page.locator("header");
    await expect(header.getByText("登录")).toBeVisible({ timeout: 3000 });
    await expect(header.getByText("注册")).toBeVisible({ timeout: 3000 });
  });

  test("unauthenticated user sees login/register in Header", async ({ page }) => {
    await page.goto(`${BASE}/`);
    const header = page.locator("header");
    await expect(header.getByText("登录")).toBeVisible({ timeout: 3000 });
    await expect(header.getByText("注册")).toBeVisible({ timeout: 3000 });
  });
});
