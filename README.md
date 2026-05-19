# 爆了么 — 自媒体爆款智能创作系统

功能同构、独立实现的自媒体爆款创作工作台。
首版已实现完整的九阶段 MVP，包含用户鉴权、素材库、提示词库、智能创作、一键排版、公众号 mock、支付 mock、推广返佣和后台运营。

## 技术栈

- **Frontend**: Next.js 16 App Router + TypeScript + Tailwind CSS
- **Backend**: Next.js Route Handlers
- **Database**: PostgreSQL (通过 Prisma ORM 7 + driver adapter)
- **AI**: MockAIProvider (默认), OpenAI-compatible Provider (通过 `AI_*` 环境变量配置)
- **Auth**: JWT (jose) + httpOnly Cookie
- **Queue**: setImmediate (MVP), 建议生产环境替换为 BullMQ + Redis
- **测试**: Vitest

## 快速开始 (推荐：Docker Postgres)

```bash
# 1. 启动 PostgreSQL
docker compose up -d

# 2. 配置 .env
cp .env.example .env
# DATABASE_URL 默认指向 Docker Postgres: localhost:15432

# 3. 安装依赖 + 初始化数据库
npm install
npx prisma db push
npm run db:seed

# 4. 启动开发服务器
npm run dev
# 访问 http://localhost:3000
# 管理员: admin / admin123
```

## 替代方案：Prisma dev (动态端口，不推荐长期使用)

```bash
npm install
npx prisma dev --name baoleme        # 启动本地 PostgreSQL
# 复制输出的 DATABASE_URL 到 .env   # 端口可能不是 51214
npx prisma db push
npm run db:seed
npm run dev
```

详见 `docs/12-deployment-readiness.md`。

## npm scripts

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 Next.js 开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm run lint` | ESLint 检查 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run test` | 运行 Vitest 测试 (246) |
| `npm run verify:unit` | lint + typecheck + test |
| `npm run verify:e2e` | Playwright 浏览器测试 (27) |
| `npm run verify:all` | 完整验收 (generate→migrate→seed→lint→tck→test×2→build→playwright) |
| `npm run db:generate` | 生成 Prisma client |
| `npm run db:migrate` | 推送 schema 到数据库 |
| `npm run db:seed` | 执行种子数据 |
| `npm run db:studio` | 打开 Prisma Studio |

## 环境变量

参见 `.env.example`。必填：

- `DATABASE_URL` — PostgreSQL 连接字符串
- `JWT_SECRET` — JWT 签名密钥（生产环境必须更换）
- `NEXT_PUBLIC_APP_URL` — 应用 URL
- `AI_PROVIDER` — AI 提供者：`mock` 或 `openai-compatible`

## Mock 边界说明

首版所有外部服务均为 mock，在 UI 和 API 响应中明确标注"模拟模式"：

- **公众号**: mock 创建/授权/草稿推送
- **支付**: mock 订单创建和支付
- **提现**: mock 审核通过/驳回，不真实打款
- **AI**: 默认 MockAIProvider，可通过 `AI_*` 环境变量切换真实 Provider

## 项目结构

```
app/            — Next.js App Router 页面和 API routes
  (public)/     — 公开页面（登录/注册）
  (dashboard)/  — 登录后页面
  api/          — API routes
components/     — React 组件
  layout/       — 布局组件（Header）
  feature/      — 功能组件
lib/            — 业务逻辑
  auth/         — 鉴权
  db/           — 数据库客户端
  services/     — 服务层
  adapters/     — 外部适配器（AI, Material, WeChat, Billing）
  queue/        — 任务队列
  validation/   — 参数校验
  utils/        — 工具函数
tests/          — 测试（246 个 Vitest + 27 个 Playwright）
prisma/         — Prisma schema, migrations, seed
docs/           — 产品/架构/开发文档
```

## 开发和部署说明

### Prisma 本地数据库

`npx prisma dev` 启动本地 PostgreSQL。端口动态分配（通常 51214，重启后可能变化）。
遇到 `Connection terminated unexpectedly` 错误时：

```bash
npx prisma dev rm <name> --force
npx prisma dev --name baoleme
# 更新 .env 中的 DATABASE_URL 为新端口
npx prisma db push
npm run db:seed
```

Playwright 验收建议使用 `npm run verify:e2e`。该脚本会先清理 3000 端口并启动干净的 Next dev server，避免复用旧 `.env` 下启动的服务。

### CI/CD

每次 push 到 `main` 或 Pull Request 时，GitHub Actions 自动运行完整验收流水线。
配置见 `.github/workflows/ci.yml`，详情见 `docs/13-ci-cd.md`。

### 试用指南

查看 `docs/14-trial-guide.md`。

### 生产部署

生产环境建议：
- 使用独立 PostgreSQL 服务
- 设置 `JWT_SECRET` 为强随机字符串
- 设置 `NODE_ENV=production`（Cookie secure 自动开启）
- 替换 MockAIProvider 为真实 AI Provider
- 队列替换为 BullMQ + Redis
- 部署前运行 `npm run build`
