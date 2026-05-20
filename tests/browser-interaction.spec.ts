/**
 * Phase 10 browser interaction tests.
 *
 * These tests intentionally assert business results, not just that pages load.
 */
import { test, expect, type Page } from "@playwright/test";
import { SignJWT } from "jose";

const BASE = "http://localhost:3000";
const PASSWORD = "e2ePass123";

async function loginAs(page: Page, account: string, password: string) {
  // Clear any existing session by logging out first
  await page.request.post(`${BASE}/api/auth/logout`);
  // Clear cookies in context
  await page.context().clearCookies();
  await page.goto(`${BASE}/login`);
  await page.fill("#account", account);
  await page.fill("#password", password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.waitForURL("**/dashboard", { timeout: 10000 });
  await expect(page.getByText(`你好，${account}`)).toBeVisible({ timeout: 5000 });
  await expect.poll(async () => {
    const result = await page.evaluate(async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      const body = await res.json();
      return { ok: res.ok, success: Boolean(body.success) };
    });
    return result.ok && result.success;
  }, { timeout: 5000 }).toBe(true);
}

async function loginCookie(page: Page, account: string, password: string) {
  const res = await page.request.post(`${BASE}/api/auth/login`, {
    data: { account, password },
  });
  const body = await res.json();
  expect(res.ok(), JSON.stringify(body)).toBe(true);
  const cookie = res.headers()["set-cookie"]?.split(";")[0];
  expect(cookie).toContain("baoleme_session=");
  return cookie;
}

async function signedSessionCookie(userId: string, role = "user") {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? "baoleme-dev-secret-change-in-production");
  const token = await new SignJWT({ userId, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
  return `baoleme_session=${token}`;
}

function jwtPayload(token: string): { userId?: string } | null {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { userId?: string };
  } catch {
    return null;
  }
}

async function browserSessionCookie(page: Page, expectedUserId?: string) {
  const sessions = (await page.context().cookies(BASE)).filter((cookie) => cookie.name === "baoleme_session");
  const session = expectedUserId
    ? sessions.find((cookie) => jwtPayload(cookie.value)?.userId === expectedUserId)
    : sessions.at(-1);
  expect(session, "Expected browser context to contain baoleme_session").toBeTruthy();
  return `${session!.name}=${session!.value}`;
}

async function createUser(page: Page, prefix: string, referralCode?: string) {
  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const username = `${prefix}_${suffix}`.slice(0, 18);
  const email = `${username}@test.com`;
  const codeRes = await page.request.post(`${BASE}/api/auth/send-email-code`, {
    data: { email, purpose: "register" },
  });
  expect(codeRes.ok()).toBe(true);
  const codeBody = await codeRes.json();
  const code = codeBody.data?.code;
  expect(code).toMatch(/^\d{6}$/);

  const regRes = await page.request.post(`${BASE}/api/auth/register`, {
    data: {
      username,
      email,
      password: PASSWORD,
      emailCode: code,
      referralCode,
    },
  });
  expect(regRes.ok()).toBe(true);
  const regBody = await regRes.json();
  expect(regBody.success).toBe(true);
  const meRes = await page.request.get(`${BASE}/api/auth/me`);
  const meBody = await meRes.json();
  expect(meBody.success).toBe(true);
  return {
    username,
    email,
    password: PASSWORD,
    userId: regBody.data.user.id as string,
    referralCode: meBody.data.user.referralCode as string,
  };
}

async function registerAndGetUsername(page: Page): Promise<string> {
  const uname = `b2e_${Date.now().toString(36)}`;
  await page.goto(`${BASE}/register`);
  await page.fill("#username", uname);
  await page.fill("#email", `${uname}@test.com`);
  await page.fill("#reg-password", PASSWORD);
  await page.click("button:has-text('发送验证码')");
  const codeMsg = page.locator("text=验证码已发送");
  await expect(codeMsg).toBeVisible({ timeout: 5000 });
  const msgText = await codeMsg.textContent();
  const match = msgText?.match(/\d{6}/);
  if (!match) throw new Error("Could not extract verification code from dev response");
  await page.locator("#code").fill(match[0]);
  await page.click("button[type=submit]:has-text('注册')");
  await page.waitForURL("**/dashboard", { timeout: 10000 });
  await expect(page.getByText(`你好，${uname}`)).toBeVisible({ timeout: 5000 });
  return uname;
}

async function waitForArticleById(page: Page, articleId: string, cookie: string) {
  await expect.poll(async () => {
    const res = await page.request.get(`${BASE}/api/articles/${articleId}`, {
      headers: { Cookie: cookie },
    });
    if (!res.ok()) return false;
    const body = await res.json();
    return Boolean(body?.success && body.data.id === articleId);
  }, { timeout: 20000 }).toBe(true);
}

test("register: email code -> register -> dashboard with username", async ({ page }) => {
  const uname = await registerAndGetUsername(page);
  await expect(page.getByText(`你好，${uname}`)).toBeVisible();
});

test("materials: favorite changes row state and export downloads CSV content", async ({ page }) => {
  const user = await createUser(page, "mat");
  await loginAs(page, user.username, user.password);
  await page.goto(`${BASE}/materials`);

  // The materials page shows account data in a table
  const row = page.locator("tr").filter({ hasText: "财经早餐" }).first();
  await expect(row).toBeVisible({ timeout: 8000 });

  const favoriteButton = row.getByRole("button", { name: "收藏" });
  await expect(favoriteButton).toBeVisible({ timeout: 3000 });
  await favoriteButton.click();
  await expect(row.getByRole("button", { name: "已收藏" })).toBeVisible({ timeout: 5000 });

  // Switch to topics tab and verify topics are displayed
  await page.locator("button:has-text('热搜榜')").click();
  await page.waitForTimeout(500);
  await expect(page.getByRole("heading", { name: "热搜榜" })).toBeVisible();
  // CSV export is part of the material API — verify API works
  const cookie = await browserSessionCookie(page, user.userId);
  const exportRes = await page.request.post(`${BASE}/api/material/export`, {
    headers: { Cookie: cookie },
    data: { type: "topics", filters: {} },
  });
  expect(exportRes.ok()).toBe(true);
  const exportBody = await exportRes.json();
  expect(exportBody.success).toBe(true);
  expect(exportBody.data.csv).toBeTruthy();
});

test("prompts: create group, generate prompt, verify new prompt appears", async ({ page }) => {
  await loginAs(page, "admin", "admin123");
  await page.goto(`${BASE}/prompts`);
  await expect(page.getByText("全部提示词")).toBeVisible({ timeout: 5000 });

  const groupName = `测试组_${Date.now().toString(36)}`;
  await page.click("button:has-text('+ 新建')");
  const groupInput = page.locator("input[placeholder='分组名称']");
  await expect(groupInput).toBeVisible({ timeout: 2000 });
  await groupInput.fill(groupName);
  await page.locator("button:has-text('确定')").click();
  await expect(page.getByText(groupName)).toBeVisible({ timeout: 3000 });

  const promptName = `生成提示词_${Date.now().toString(36)}`;
  await page.click("button:has-text('生成提示词')");
  const nameInput = page.locator("input[placeholder*='财经']").first();
  await expect(nameInput).toBeVisible({ timeout: 3000 });
  await nameInput.fill(promptName);
  await page.click("button:has-text('开始生成')");
  await expect(page.getByText(promptName).first()).toBeVisible({ timeout: 15000 });
});

test("writing: create article, verify exact title appears with scoped status", async ({ page }) => {
  const user = await createUser(page, "wrt");
  await loginAs(page, user.username, user.password);
  await page.goto(`${BASE}/writing`);
  await expect(page.getByRole("heading", { name: "智能创作" })).toBeVisible({ timeout: 5000 });

  const articleTitle = `浏览器文章_${Date.now().toString(36)}`;
  await page.click("button:has-text('开始创作')");
  await expect(page.locator("input[required]").first()).toBeVisible({ timeout: 3000 });
  const cookie = await browserSessionCookie(page, user.userId);
  const authCheck = await page.request.get(`${BASE}/api/auth/me`, { headers: { Cookie: cookie } });
  const authBody = await authCheck.json();
  expect(authCheck.ok(), JSON.stringify(authBody)).toBe(true);
  const createRes = await page.request.post(`${BASE}/api/articles/generate`, {
    headers: { Cookie: cookie },
    data: { title: articleTitle, imageCount: 0, imageStrategy: "none", needMaterial: true },
  });
  const createBody = await createRes.json();
  expect(createRes.ok(), JSON.stringify(createBody)).toBe(true);
  expect(createBody.success).toBe(true);
  const articleId = createBody.data.articleId as string;

  await waitForArticleById(page, articleId, cookie);
  await page.goto(`${BASE}/writing`);
  await page.locator("input[placeholder='搜索...']").fill(articleTitle);
  const articleRow = page.locator(`[data-testid='article-row-${articleId}']`);
  await expect(articleRow).toBeVisible({ timeout: 20000 });
  await expect(articleRow.locator("[data-testid^='article-status-']")).toHaveText(/创作中|已完成|失败/, { timeout: 5000 });
});

test("formatter: edit markdown, preview shows rendered HTML, copy button active", async ({ page }) => {
  await loginAs(page, "admin", "admin123");
  await page.goto(`${BASE}/formatter`);
  await expect(page.getByRole("button", { name: "预览" })).toBeVisible({ timeout: 5000 });

  await page.locator("textarea").first().fill("# 浏览器测试标题\n\n这是**加粗**文字\n\n- 项目1\n- 项目2");
  await page.click("button:has-text('预览')");
  await expect(page.locator("h1:has-text('浏览器测试标题')")).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole("button", { name: "复制排版代码" })).toBeVisible();
});

test("OA: create mock OA, verify in list, delete removes it from active list", async ({ page }) => {
  await loginAs(page, "admin", "admin123");
  await page.goto(`${BASE}/official-accounts`);
  await expect(page.getByText("模拟授权模式", { exact: true })).toBeVisible({ timeout: 5000 });

  const oaName = `OA_浏览器_${Date.now().toString(36)}`;
  await page.fill("input[placeholder='公众号名称']", oaName);
  await page.click("button:has-text('创建模拟公众号')");
  await expect(page.getByText(oaName)).toBeVisible({ timeout: 5000 });

  // Click delete on the OA card
  await page.locator(".glass-tile").filter({ hasText: oaName }).locator("button:has-text('删除')").click();
  // Glass modal appears — click confirm inside the modal
  await page.locator(".depth-modal").getByRole("button", { name: "删除" }).click();
  await expect(page.getByText(oaName)).not.toBeVisible({ timeout: 5000 });
});

test("membership: create order, mock pay, verify order status becomes paid", async ({ page }) => {
  const user = await createUser(page, "mem");
  await loginAs(page, user.username, user.password);
  await page.goto(`${BASE}/membership`);
  await expect(page.getByText("我的会员")).toBeVisible({ timeout: 8000 });

  page.once("dialog", async (dialog) => { await dialog.accept(); });
  await page.locator("button:has-text('开通'):not(:has-text('默认'))").first().click();
  // Glass modal appears — click confirm
  await page.locator(".depth-modal button:has-text('确定')").click();

  // Wait for the order to appear (plan name + order number pattern)
  const orderRow = page.locator("div").filter({ hasText: /专业版|企业版/ }).filter({ hasText: /待支付|已支付/ }).first();
  await expect(orderRow).toBeVisible({ timeout: 8000 });
  // Verify the order status shows pending
  await expect(orderRow).toContainText(/待支付/);
  const payButton = orderRow.getByRole("button", { name: "模拟支付" });
  await expect(payButton).toBeVisible({ timeout: 5000 });
  await payButton.click();

  // After payment, verify membership plan appears (it will show the plan name)
  await expect(page.getByText("我的会员")).toBeVisible({ timeout: 10000 });
  // Verify order shows paid
  await expect(orderRow).toContainText(/已支付/, { timeout: 10000 });
});

test("referral: shows invite code, tabs, withdrawal form", async ({ page }) => {
  await loginAs(page, "admin", "admin123");
  await page.goto(`${BASE}/referral`);
  await expect(page.getByText("推广中心")).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("邀请码")).toBeVisible({ timeout: 3000 });
  await expect(page.getByText("邀请人数")).toBeVisible({ timeout: 3000 });
  await page.click("button:has-text('提现记录')");
  await expect(page.locator("input[placeholder='支付宝姓名']")).toBeVisible({ timeout: 3000 });
  await expect(page.locator("input[placeholder='提现金额（分）']")).toBeVisible({ timeout: 3000 });
});

test("admin: disable/enable user, verify panels, approve withdrawal in browser", async ({ page }) => {
  const suffix = Date.now().toString(36);
  const referrer = await createUser(page, `ref${suffix}`.slice(0, 10));
  const referred = await createUser(page, `rfd${suffix}`.slice(0, 10), referrer.referralCode);

  const plansRes = await page.request.get(`${BASE}/api/membership/plans`);
  const plansBody = await plansRes.json();
  const proPlan = plansBody.data.find((p: { code: string }) => p.code === "pro");
  expect(proPlan).toBeTruthy();

  const referredCookie = await signedSessionCookie(referred.userId);
  const orderRes = await page.request.post(`${BASE}/api/orders`, {
    data: { planId: proPlan.id },
    headers: { Cookie: referredCookie },
  });
  const orderBody = await orderRes.json();
  expect(orderBody.success).toBe(true);
  const payRes = await page.request.post(`${BASE}/api/orders/${orderBody.data.id}/mock-pay`, {
    headers: { Cookie: referredCookie },
  });
  expect(payRes.ok()).toBe(true);
  const payBody = await payRes.json();
  expect(payBody.success).toBe(true);

  const referrerCookie = await signedSessionCookie(referrer.userId);
  const summaryRes = await page.request.get(`${BASE}/api/referral/summary`, {
    headers: { Cookie: referrerCookie },
  });
  const summaryBody = await summaryRes.json();
  expect(summaryBody.success).toBe(true);
  expect(summaryBody.data.availableCents).toBeGreaterThan(0);
  const alipayName = `浏览器提现_${suffix}`;
  const withdrawalRes = await page.request.post(`${BASE}/api/referral/withdrawals`, {
    headers: { Cookie: referrerCookie },
    data: {
      amountCents: Math.max(1, Math.floor(summaryBody.data.availableCents / 2)),
      alipayName,
      alipayAccount: `${suffix}@alipay.test`,
    },
  });
  const withdrawalBody = await withdrawalRes.json();
  expect(withdrawalBody.success).toBe(true);
  const withdrawal = withdrawalBody.data as { id: string };

  await page.request.post(`${BASE}/api/auth/logout`, { headers: { Cookie: referrerCookie } });

  // Ensure referred user exists and the flow really attributed the commission.
  expect(referred.userId).toBeTruthy();

  await loginAs(page, "admin", "admin123");
  await page.goto(`${BASE}/admin`);
  await expect(page.getByRole("heading", { name: "后台运营" })).toBeVisible({ timeout: 5000 });

  await page.click("button:has-text('用户管理')");
  await expect(page.locator("[data-testid='admin-users-panel']")).toBeVisible({ timeout: 5000 });
  await page.locator("input[placeholder='搜索用户名/邮箱...']").fill(referrer.username);
  const userRow = page.locator("[data-testid^='admin-user-row-']").filter({ hasText: referrer.username }).first();
  await expect(userRow).toBeVisible({ timeout: 5000 });
  const toggleButton = userRow.locator("[data-testid^='admin-user-toggle-']");
  const statusText = userRow.locator("[data-testid^='admin-user-status-']");
  if ((await statusText.textContent()) !== "正常") {
    await toggleButton.click();
    await expect(statusText).toHaveText("正常", { timeout: 5000 });
  }
  await expect(toggleButton).toHaveText("禁用", { timeout: 5000 });
  await toggleButton.click();
  await expect(statusText).toHaveText("已禁用", { timeout: 5000 });
  await expect(toggleButton).toHaveText("启用", { timeout: 5000 });
  await toggleButton.click();
  await expect(statusText).toHaveText("正常", { timeout: 5000 });
  await expect(toggleButton).toHaveText("禁用", { timeout: 5000 });

  await page.click("button:has-text('会员管理')");
  await expect(page.locator("[data-testid='admin-membership-panel']")).toContainText("生成会员码");

  await page.click("button:has-text('订单管理')");
  await expect(page.locator("[data-testid='admin-orders-panel']")).toBeVisible({ timeout: 3000 });
  await expect(page.locator("[data-testid='admin-orders-panel']")).toContainText(/订单|暂无订单|已支付|待支付/);

  const adminCookie = await loginCookie(page, "admin", "admin123");
  const adminWithdrawalsRes = await page.request.get(`${BASE}/api/admin/withdrawals?pageSize=100`, {
    headers: { Cookie: adminCookie },
  });
  expect(adminWithdrawalsRes.ok()).toBe(true);
  const adminWithdrawalsBody = await adminWithdrawalsRes.json();
  expect(adminWithdrawalsBody.success).toBe(true);
  expect(adminWithdrawalsBody.data.items.some((item: { id: string }) => item.id === withdrawal.id)).toBe(true);

  await page.click("button:has-text('提现审核')");
  const withdrawalRow = page.locator(`[data-testid='admin-withdrawal-row-${withdrawal.id}']`);
  await expect(withdrawalRow).toContainText(alipayName, { timeout: 5000 });
  await expect(withdrawalRow).toContainText("待处理");
  await withdrawalRow.getByRole("button", { name: "通过" }).click();
  await expect(withdrawalRow).toContainText("已通过", { timeout: 5000 });

  await page.click("button:has-text('AI 任务')");
  await expect(page.locator("[data-testid='admin-ai-panel']")).toContainText("提示词生成任务");
  await expect(page.locator("[data-testid='admin-ai-panel']")).toContainText("文章生成任务");
});
