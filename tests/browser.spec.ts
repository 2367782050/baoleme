import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";

test.describe("Public pages", () => {
  test("/ returns 200 and shows product name", async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByRole("heading", { name: "爆了么" })).toBeVisible();
    await expect(page.getByRole("link", { name: "开始创作" })).toBeVisible();
  });
  test("/login shows login form", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await expect(page.getByRole("heading", { name: "登录" })).toBeVisible();
    await expect(page.locator("input#account")).toBeVisible();
    await expect(page.locator("button[type=submit]")).toBeVisible();
  });
  test("/register shows register form", async ({ page }) => {
    await page.goto(`${BASE}/register`);
    await expect(page.getByRole("heading", { name: "注册" })).toBeVisible();
    await expect(page.locator("button:has-text('发送验证码')")).toBeVisible();
  });
});

test.describe("Auth flow", () => {
  test("admin login works", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill("input#account", "admin");
    await page.fill("input#password", "admin123");
    await page.click("button[type=submit]");
    await page.waitForURL("**/dashboard", { timeout: 10000 });
    await expect(page.getByText("你好，admin")).toBeVisible({ timeout: 5000 });
  });
  test("/dashboard redirects to /login when unauthenticated", async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForURL("**/login", { timeout: 5000 });
    await expect(page.getByRole("heading", { name: "登录" })).toBeVisible();
  });
  test("wrong password shows error", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill("input#account", "admin");
    await page.fill("input#password", "wrongpassword");
    await page.click("button[type=submit]");
    await expect(page.locator(".text-red-500, .text-red-600").first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Dashboard pages (as admin)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill("input#account", "admin");
    await page.fill("input#password", "admin123");
    await page.click("button[type=submit]");
    await page.waitForURL("**/dashboard", { timeout: 10000 });
  });

  const pages = [
    "/materials", "/prompts", "/writing", "/formatter",
    "/official-accounts", "/membership", "/referral", "/admin",
  ];
  for (const path of pages) {
    test(`${path} returns 200`, async ({ page }) => {
      const resp = await page.goto(`${BASE}${path}`);
      expect([200, 304, 307].includes(resp?.status() ?? 0)).toBe(true);
    });
  }

  test("materials page has tabs", async ({ page }) => {
    await page.goto(`${BASE}/materials`);
    await expect(page.getByRole("heading", { name: "爆款素材" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("热搜榜")).toBeVisible();
    await expect(page.getByText("如何找对标")).toBeVisible();
  });

  test("formatter has editor and buttons", async ({ page }) => {
    await page.goto(`${BASE}/formatter`);
    await expect(page.getByRole("button", { name: "预览" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "复制 HTML" })).toBeVisible();
    await expect(page.locator("textarea").first()).toBeVisible();
  });

  test("admin page has tabs", async ({ page }) => {
    await page.goto(`${BASE}/admin`);
    await expect(page.getByRole("heading", { name: "后台运营" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("用户管理")).toBeVisible();
  });
});

test.describe("Console errors", () => {
  test("key pages have no uncaught errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => {
      // Ignore 401 from Header server component that fetches /api/auth/me on every page
      if (e.message.includes("401") || e.message.includes("Unauthorized")) return;
      errors.push(e.message);
    });
    for (const path of ["/", "/login", "/register"]) {
      await page.goto(`${BASE}${path}`);
      await page.waitForTimeout(500);
    }
    expect(errors).toHaveLength(0);
  });
});
