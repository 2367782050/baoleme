# Phase 21：生产试用环境部署指南

## 进程架构

生产/试用环境需要 **两个常驻进程**：

| 进程 | 命令 | 说明 |
|------|------|------|
| Web | `npm run start` | Next.js 生产服务器（端口 3000） |
| AI Worker | `npm run worker:ai` | DB worker，轮询并执行 AI 任务 |

两个进程必须连接同一个 PostgreSQL 数据库（`DATABASE_URL` 相同）。

## 部署步骤

### 1. 准备数据库

```bash
# 创建 PostgreSQL 实例（Docker / 云服务）
# 确保 DATABASE_URL 指向正确地址

# 初始化 schema
npx prisma db push

# 生成 Prisma client
npm run db:generate

# 导入种子数据（管理员、会员套餐、素材样例）
npm run db:seed
```

### 2. 配置环境变量

```bash
cp .env.production.example .env
# 编辑 .env，填写真实值
```

关键配置：
- `DATABASE_URL` — 必须独立 PostgreSQL
- `JWT_SECRET` — 必须强随机字符串（`openssl rand -hex 32`）
- `AI_API_KEY` — DeepSeek 或其他兼容 Provider 的 API Key
- 不要使用 Prisma dev 的地址（端口动态变化，重启即失效）

### 3. 构建

```bash
npm run build
```

### 4. 运行前检查

```bash
npm run preflight:prod
```

检查项：
- DATABASE_URL、JWT_SECRET 存在且合法
- 数据库可连接
- AI 配置完整（如果使用真实 AI）
- 所有检查通过后才启动服务

### 5. 启动

```bash
# 终端 1: Web 服务
npm run start

# 终端 2: AI Worker
npm run worker:ai
```

## Worker 保活方案

### 方案 A：Docker Compose（推荐试用环境）

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: baoleme
      POSTGRES_PASSWORD: baoleme_prod
      POSTGRES_DB: baoleme
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]

  web:
    build: .
    command: npm run start
    ports: ["3000:3000"]
    env_file: .env
    depends_on: [db]

  worker:
    build: .
    command: npm run worker:ai
    env_file: .env
    depends_on: [db]

volumes:
  pgdata:
```

### 方案 B：PM2（推荐 VPS）

```bash
npm install -g pm2
pm2 start npm --name "baoleme-web" -- run start
pm2 start npm --name "baoleme-worker" -- run worker:ai
pm2 save
pm2 startup
```

### 方案 C：systemd（推荐 Linux 服务器）

```ini
# /etc/systemd/system/baoleme-worker.service
[Unit]
Description=BAOLEME AI Worker
After=network.target

[Service]
Type=simple
User=baoleme
WorkingDirectory=/opt/baoleme
ExecStart=/usr/bin/npm run worker:ai
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### Worker 掉线怎么办

- AI 任务会停留在 `pending` 状态。
- 如果 Worker 重启，恢复逻辑会处理：
  - `running` 超时 10 分钟 → 重置为 `pending`（attempts < maxAttempts）
  - `running` 超时且 attempts 已满 → 标记 `failed`
- 生产建议：对 worker 进程加监控告警（uptime、pending 任务堆积数量）

## 安全清单

| 项 | 要求 |
|----|------|
| 管理员密码 | 默认 `admin/admin123`，试用前必须修改 |
| JWT_SECRET | 强随机字符串，≥32 位 |
| API Key | 额度保护，不提交到 git |
| .env | 不提交（已在 .gitignore） |
| 注册验证码 | dev 模式直接返回验证码，生产需接真实邮件服务 |
| Mock 支付 | 页面标注"模拟支付"，不产生真实交易 |
| Mock 公众号 | 页面标注"模拟授权"，未连接微信开放平台 |
| Mock 提现 | 审核通过/驳回，不执行真实打款 |

## 试用启动检查清单

- [ ] PostgreSQL 独立运行（非 Prisma dev）
- [ ] .env 已配置且通过 preflight:prod
- [ ] 管理员密码已修改
- [ ] AI_API_KEY 已配置
- [ ] npm run build 成功
- [ ] npm run start 启动，浏览器访问正常
- [ ] npm run worker:ai 启动，Worker 日志正常
- [ ] 提示词生成真实 AI 完成
- [ ] 文章生成真实 AI 完成
- [ ] 管理后台可查看任务状态
