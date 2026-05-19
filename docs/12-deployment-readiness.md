# Phase 12 — 部署准备与预生产环境固定化

## 本地 Docker 启动步骤 (推荐)

```bash
# 1. 启动 PostgreSQL
docker compose up -d

# 2. 配置 .env
cp .env.example .env
# DATABASE_URL 已默认指向 Docker Postgres: localhost:15432

# 3. 安装依赖 + 初始化数据库
npm install
npx prisma db push
npm run db:seed

# 4. 启动开发服务器
npm run dev
# 访问 http://localhost:3000

# 5. 停止 PostgreSQL
docker compose down
```

## 替代方案：Prisma dev (不推荐长期验收)

```bash
npx prisma dev --name baoleme
# 复制输出的 DATABASE_URL 到 .env
npx prisma db push
npm run db:seed
npm run dev
```

注意：Prisma dev 端口动态分配，重启后可能变化。遇到
`Server has closed the connection` 时需重启 `prisma dev`。

## 测试服务器部署步骤

```bash
# 1. 克隆仓库
git clone <repo-url>
cd BAOLEME

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env: 设置 DATABASE_URL, JWT_SECRET, AI_PROVIDER 等

# 4. 初始化数据库
npx prisma db push
npm run db:seed

# 5. 运行验收
npm run verify:unit
npm run verify:e2e

# 6. 构建和启动
npm run build
npm start
```

## 必填环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| DATABASE_URL | PostgreSQL 连接字符串 | 见 .env.example |
| JWT_SECRET | JWT 签名密钥 | change-me-in-production |
| NEXT_PUBLIC_APP_URL | 应用 URL | http://localhost:3000 |
| AI_PROVIDER | AI 提供者 | mock |

## Seed 管理员账号

- 用户名: `admin`
- 密码: `admin123`
- 角色: `admin`
- 会员: 专业版 (pro)

## Mock 边界说明

所有外部服务均为 mock：

- AI: MockAIProvider (默认), 可通过 `AI_*` 环境变量切换真实 Provider
- 公众号: MockWeChatDraftAdapter
- 支付: MockBillingAdapter (订单号 MOCK_...)
- 提现: 审核仅改状态，不真实打款
- 邮箱: dev 模式 API 返回验证码

## 生产上线前必须替换

1. `JWT_SECRET` → 强随机字符串
2. `DATABASE_URL` → 独立 PostgreSQL
3. MockAIProvider → 真实 AI Provider (设置 `AI_*` 环境变量)
4. setImmediate → BullMQ + Redis
5. admin 密码: seed 中 `admin123` → 生产环境强密码
6. Mock 公众号/支付/提现 → 对接真实服务

## 验收命令顺序

```bash
npm run db:generate      # 生成 Prisma client
npm run db:migrate       # 推送 schema
npm run db:seed          # 种子数据
npm run lint             # 0 errors, 0 warnings
npm run typecheck        # TypeScript 类型检查
npm run test             # Vitest 246 个测试 (运行两次)
npm run build            # Next.js 构建
npx playwright test --workers=1  # 27 个浏览器测试
```

## npm verify 脚本

| 命令 | 说明 |
|------|------|
| `npm run verify:unit` | lint + typecheck + vitest |
| `npm run verify:e2e` | Playwright 浏览器测试 (workers=1) |
| `npm run verify:all` | 完整验收: generate + migrate + seed + lint + typecheck + test ×2 + build + playwright |

这些脚本通过 `scripts/verify.mjs` 顺序执行命令，避免依赖 Bash/PowerShell 特定的链式语法。

## 常见故障

### 数据库连接失败 (`Can't reach database server`)
- Docker Postgres: 检查 `docker compose ps`，确认容器运行中
- Prisma dev: 先运行 `npx prisma dev rm <name> --force`，再运行 `npx prisma dev --name baoleme`
- 检查 `.env` 中 `DATABASE_URL` 端口是否正确

### 端口占用 (15432)
- 修改 `docker-compose.yml` 中 `ports` 映射
- 同步更新 `.env` 中 `DATABASE_URL` 端口

### JWT_SECRET 缺失
- 检查 `.env` 中是否有 `JWT_SECRET`
- 默认值 `change-me-in-production` 仅用于开发

### Playwright 浏览器登录失败
- 确保 `npx playwright install chromium` 已执行
- 优先运行 `npm run verify:e2e`，该脚本会先清理 3000 端口并启动干净的 Next dev server
- 如果手动运行 `npx playwright test`，不要复用旧的 dev server；必要时先停止 3000 端口进程
- 参考 `tests/browser-interaction.spec.ts` 中的 `loginAs` helper

### Prisma dev 端口变化
- 重启后端口可能从 51214 变为 51218 等
- 运行 `npx prisma dev ls` 查看当前端口
- 更新 `.env` 中 `DATABASE_URL` 端口

## 健康检查

```bash
curl http://localhost:3000/api/health
# {"ok":true,"database":"ok","timestamp":"..."}
```
