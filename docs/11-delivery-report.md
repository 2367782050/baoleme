# Phase 11 — 交付报告

## 项目概述

爆了么（BAOLEME）是一个功能同构、独立实现的自媒体爆款智能创作工作台。
首版 MVP 覆盖用户注册/登录、爆款素材库、AI 提示词生成、AI 智能创作、
一键排版、公众号 mock、会员/支付 mock、推广返佣和后台运营管理。

## 技术栈

| 层次 | 选型 |
|------|------|
| Frontend | Next.js 16 App Router + TypeScript |
| Styling | Tailwind CSS v4 |
| Backend | Next.js Route Handlers |
| Database | PostgreSQL (Prisma ORM 7 + @prisma/adapter-pg) |
| Auth | JWT (jose) + httpOnly Cookie (`baoleme_session`) |
| AI | AIProvider 抽象 → MockAIProvider / OpenAI-compatible |
| Queue | setImmediate (MVP) |
| Test | Vitest (245 tests) + Playwright (27 browser tests) |

## 页面路由清单

| 路由 | 页面 | 鉴权 |
|------|------|------|
| `/` | 首页 | 公开 |
| `/login` | 登录 | 公开 |
| `/register` | 注册 | 公开 |
| `/dashboard` | 工作台 | 需登录 |
| `/materials` | 爆款素材 | 需登录 |
| `/prompts` | 提示词库 | 需登录 |
| `/writing` | 智能创作 | 需登录 |
| `/formatter` | 一键排版 | 需登录 |
| `/official-accounts` | 公众号管理 | 需登录 |
| `/membership` | 会员中心 | 需登录 |
| `/referral` | 推广中心 | 需登录 |
| `/admin` | 后台运营 | 需 admin |

## API 路由清单 (45 routes)

### Auth (5)
- `POST /api/auth/send-email-code`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Membership (4)
- `GET /api/membership/plans`
- `GET /api/membership/current`
- `GET /api/membership/quota`
- `POST /api/membership/redeem-code`

### Materials (7)
- `GET /api/material/domains`
- `GET /api/material/accounts`
- `GET /api/material/articles`
- `GET /api/material/hot-topics`
- `POST/DELETE /api/material/favorites`
- `POST /api/material/export`
- `POST /api/admin/material/import`

### Prompts (5)
- `GET/POST/PUT/DELETE /api/prompts/groups`
- `GET/POST /api/prompts`
- `GET/PUT/DELETE /api/prompts/[id]`
- `POST /api/prompts/generate`
- `GET /api/prompts/generation-jobs/[id]`

### Articles (6)
- `GET/POST/PUT/DELETE /api/article/groups`
- `GET /api/articles`
- `GET/PUT/DELETE /api/articles/[id]`
- `POST /api/articles/generate`
- `GET /api/articles/jobs/[id]`
- `POST /api/articles/jobs/[id]/retry`

### Formatter (1)
- `POST /api/formatter/render`

### Official Accounts (2)
- `GET/POST/DELETE /api/official-accounts`
- `POST /api/official-accounts/mock`

### Orders (2)
- `GET/POST /api/orders`
- `POST /api/orders/[id]/mock-pay`

### Referral (4)
- `GET /api/referral/summary`
- `GET /api/referral/users`
- `GET /api/referral/commissions`
- `GET/POST /api/referral/withdrawals`

### Admin (9)
- `GET /api/admin/users`
- `POST /api/admin/users/[id]/status`
- `POST /api/admin/membership/grant`
- `POST /api/admin/membership/codes`
- `GET /api/admin/orders`
- `GET /api/admin/withdrawals`
- `POST /api/admin/withdrawals/[id]`
- `GET /api/admin/jobs/prompts`
- `GET /api/admin/jobs/articles`

## 数据模型 (25 tables)

users, email_verification_codes, audit_logs, membership_plans, user_memberships,
quota_usage, material_domains, material_accounts, material_articles, hot_topics,
favorites, prompt_groups, prompts, prompt_generation_jobs, article_groups,
articles, article_generation_jobs, official_account_groups, official_accounts,
draft_push_tasks, orders, membership_codes, referral_commissions,
withdrawal_requests, files

## 已实现功能模块

| 模块 | 状态 | 说明 |
|------|------|------|
| 用户注册/登录 | ✅ | JWT + httpOnly Cookie, 邮箱验证码 (mock) |
| 会员配额 | ✅ | 3 套餐, 6 能力配额, 日/月/终身周期 |
| 爆款素材 | ✅ | 榜单/对标号/热搜/文章素材, 收藏/导出/引用 |
| 提示词库 | ✅ | 分组 CRUD, AI 生成提示词, 异步任务 |
| 智能创作 | ✅ | 文章生成, 审核→重写流水线, 失败重试 |
| 一键排版 | ✅ | Markdown→HTML, 10 模板, 复制 HTML |
| 公众号管理 | ✅ | Mock 创建/授权/草稿推送/撤销 |
| 会员中心 | ✅ | 套餐/订单/mock 支付/会员码兑换 |
| 推广中心 | ✅ | 邀请码/佣金/提现申请 |
| 后台运营 | ✅ | 用户/会员/订单/提现/AI 任务管理, audit_logs |

## Mock 服务边界

**所有外部服务均为 mock，未接真实服务：**

| 服务 | Mock 实现 | 标识 |
|------|----------|------|
| AI 生成 | MockAIProvider | 固定中文输出, test failNext/setForceRewrite |
| 公众号授权 | MockWeChatDraftAdapter | 状态 mock_authorized, draftId mock_draft_... |
| 草稿推送 | MockWeChatDraftAdapter | 消息 【模拟模式】 |
| 支付 | MockBillingAdapter | 订单号 MOCK_..., 消息 (未真实扣款) |
| 提现打款 | 无 | 审核仅改状态, 不真实打款 |
| 邮箱验证 | 无邮件服务 | dev 模式 API 返回 code |
| 素材来源 | SeedImportMaterialProvider | 数据库导入, 无爬虫 |

## 测试覆盖

| 类型 | 数量 | 文件 |
|------|------|------|
| Vitest 单元/集成 | 245 | 17 files |
| Playwright 浏览器 smoke | 18 | browser.spec.ts |
| Playwright 浏览器交互 | 9 | browser-interaction.spec.ts |
| 总测试 | 272 | 17 Vitest files + 2 Playwright spec files |

浏览器交互测试覆盖：
- 注册→dashboard（验证码提取 + 成功跳转）
- 素材收藏按钮 + CSV 导出下载验证
- 提示词分组创建 + AI 生成 + 列表刷新
- 文章创建 + 标题/状态确认
- 排版编辑 + h1 渲染 + 复制按钮
- 公众号创建 + 列表显示 + 删除消失
- 会员订单创建 + mock 支付确认
- 推广邀请码/提现表单
- 后台禁用/启用用户 + 5 tab 内容验证

## 部署步骤

### 本地开发
```bash
npm install
npx prisma dev --name baoleme    # 启动本地 PostgreSQL
# 复制 DATABASE_URL 到 .env
npx prisma db push
npm run db:seed
npm run dev                       # http://localhost:3000
```

### 生产部署
```bash
# 1. 设置环境变量 (.env)
DATABASE_URL=postgres://user:pass@host:5432/baoleme
JWT_SECRET=<强随机字符串>
NEXT_PUBLIC_APP_URL=https://your-domain.com
AI_PROVIDER=openai-compatible
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=sk-...
AI_MODEL=gpt-4o

# 2. 迁移数据库
npx prisma db push
npm run db:seed

# 3. 构建和启动
npm run build
npm start
```

### 生产上线前必须替换
- `JWT_SECRET` 为强随机字符串
- `DATABASE_URL` 为独立 PostgreSQL
- MockAIProvider → 真实 AI Provider (设置 `AI_*` 环境变量)
- setImmediate 队列 → BullMQ + Redis
- admin 密码 (seed 中 `admin123`)

## 后续迭代建议

1. **真实 AI Provider**: 配置 OpenAI-compatible API (已实现, 仅需环境变量)
2. **队列升级**: setImmediate → BullMQ + Redis
3. **微信开放平台**: 替换 MockWeChatDraftAdapter 为真实 WeChatDraftAdapter
4. **真实支付**: 替换 MockBillingAdapter, 接入支付宝/微信支付
5. **对象存储**: 实现 S3/R2 StorageAdapter
6. **提现打款**: 管理员审核后对接真实打款
7. **素材供应商**: 接入第三方素材 API
8. **监控和日志**: 接入生产级错误监控

## 验收命令结果

| 命令 | 结果 |
|------|------|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | 通过 |
| `npm run test` (×2) | 245/245 稳定 |
| `npm run build` | 45 routes |
| `npx playwright test --workers=1` | 27/27 |

## 管理员账号

- 用户名: `admin`
- 密码: `admin123`
- 角色: `admin`
- 会员: 专业版 (pro)

## 测试会员码

- `TESTVIP2026` → 专业版

## Prisma Dev 端口变化处理

Prisma dev 本地 PostgreSQL 端口动态分配。重启后可能变化：

```bash
# 检查当前端口
npx prisma dev ls

# 更新 .env DATABASE_URL 为新端口
# 例如: postgres://postgres:postgres@localhost:51214/baoleme

# 重新推送 schema
npx prisma db push && npm run db:seed
```

## 生产上线风险

1. **DB**: Prisma dev 仅本地使用，生产需独立 PostgreSQL
2. **AI**: MockAIProvider 不产生真实内容，需配置 `AI_*` 环境变量
3. **队列**: setImmediate 进程内执行，不持久化，不重试，生产不可用
4. **JWT**: `JWT_SECRET` 默认值不安全，生产必须更换
5. **支付/公众号/提现**: 全部 mock，接真实服务需开发和测试
