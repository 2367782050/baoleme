# Phase 13 — CI/CD 验收流水线

## CI 运行内容

每次 push 到 `main` 或创建 Pull Request 时，GitHub Actions 自动运行：

1. `npm run db:generate` — 生成 Prisma client
2. `npm run db:migrate` — 推送 schema 到 PostgreSQL
3. `npm run db:seed` — 种子数据
4. `npm run lint` — ESLint
5. `npm run typecheck` — TypeScript 类型检查
6. `npm run test` × 2 — Vitest (246 tests)
7. `npm run build` — Next.js 构建
8. `npm run verify:e2e` — Playwright 浏览器测试 (27 tests)

## GitHub Actions 环境变量

| 变量 | CI 值 | 说明 |
|------|------|------|
| DATABASE_URL | `postgres://baoleme:baoleme_ci@localhost:5432/baoleme` | 连接 service container PostgreSQL |
| JWT_SECRET | `ci-test-secret-do-not-use-in-production` | CI 专用测试密钥 |
| NEXT_PUBLIC_APP_URL | `http://localhost:3000` | Next.js 本地开发地址 |
| AI_PROVIDER | `mock` | 使用 MockAIProvider |

## 为什么 CI 用 PostgreSQL service container

- `prisma dev` 仅本地可用，不支持 CI 容器环境
- GitHub Actions 原生 `services.postgres` 启动标准 PostgreSQL，端口固定 5432
- `@prisma/adapter-pg` 直接连接 `DATABASE_URL`，无需额外配置

## 为什么 Playwright workers=1

- 浏览器测试需要登录（cookie-based session），并行 workers 会产生 session 冲突
- `verify:e2e` 脚本已使用 `--workers=1`
- `scripts/verify.mjs` 会在运行 Playwright 前清理本机 3000 端口，避免复用旧的 Next dev 进程
- `playwright.config.ts` 默认不复用已有 dev server；如需手动复用，可显式设置 `PLAYWRIGHT_REUSE_SERVER=1`

## 常见失败排查

### 数据库连接失败
检查 `DATABASE_URL` 是否正确指向 service container：
```
postgres://baoleme:baoleme_ci@localhost:5432/baoleme
```
确认 service container 的 `health-cmd: pg_isready` 已通过。

### Playwright 浏览器缺失
确保 CI 中已执行 `npx playwright install --with-deps chromium`。
此命令下载 Chromium 和系统依赖。

### 端口 3000 占用
`npm run verify:e2e` 会先清理 3000 端口，再由 Playwright 自动启动 `next dev --port 3000`。
如果直接运行 `npx playwright test` 且端口被占用，需先 kill 占用进程，或显式设置 `PLAYWRIGHT_REUSE_SERVER=1`。

### JWT_SECRET 缺失
CI 中已设置 `JWT_SECRET: ci-test-secret-do-not-use-in-production`。
本地开发需在 `.env` 中设置 `JWT_SECRET`。

### seed 幂等失败
种子数据使用 `upsert`/`findFirst + create` 模式，多次运行不会重复创建。
如遇到唯一约束冲突，检查数据模型是否与 schema 一致。

## 本地复现 CI

```bash
# 模拟 CI 环境
npm ci
npx prisma db push
npm run db:seed
npm run lint
npm run typecheck
npm run test
npm run test
npm run build
npm run verify:e2e
```

或直接使用 `npm run verify:all`（等价于 CI pipeline）。
