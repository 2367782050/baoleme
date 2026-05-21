# Phase 22：本机/测试服务器试用包

这不是公网部署，而是让试用者在本地或测试服务器上快速启动爆了么的方法。

## 快速启动

```bash
npm install
cp .env.example .env          # 编辑 .env 配置数据库和 AI
npm run trial:check            # 检查环境
npm run trial:start            # 一键启动 Web + AI Worker
```

访问 http://localhost:3000

管理员: admin / admin123

按 Ctrl+C 停止所有服务。

## 环境要求

- Node.js 20+
- PostgreSQL（Docker 或独立安装）
- DeepSeek API Key（可选，默认使用 Mock AI）

## .env 配置

```env
DATABASE_URL="postgres://user:pass@localhost:5432/baoleme"
AI_PROVIDER=openai-compatible
AI_API_KEY=sk-your-key
AI_MODEL=deepseek-chat
```

如果不想配置真实 AI，可以留空，系统会自动使用 Mock Provider。

## 什么是 trial:check

检查以下内容，不修改数据库：

- Node 版本
- 依赖是否安装
- .env 是否存在
- DATABASE_URL 和 JWT_SECRET 是否配置
- 数据库是否可连接
- Prisma client 是否生成
- 开发服务器是否在运行

全部通过后输出"环境就绪"。

## 什么是 trial:start

自动执行：生成 Prisma client → 同步 schema → 导入种子数据 → 启动 Web 服务 → 启动 AI Worker → 打印访问信息。

Ctrl+C 同时关闭 Web 和 Worker。

## 账号

| 角色 | 账号 | 密码 |
|------|------|------|
| 管理员 | admin | admin123 |

普通用户通过注册页面创建。

## Mock 边界

当前版本以下功能为模拟：

- **支付**：页面标注"模拟支付"，不产生真实交易
- **公众号**：页面标注"模拟授权"，未连接微信开放平台
- **提现**：审核通过/驳回，不执行真实打款
- **AI**：默认 Mock Provider，配置 DeepSeek API Key 后可切换真实 AI

## 常见问题

### 数据库连不上

检查 PostgreSQL 是否运行：
```bash
docker ps | grep postgres   # Docker
pg_isready                   # 本地安装
```

### 端口 3000 被占用

```bash
# Windows
netstat -ano | findstr :3000
taskkill /F /PID <PID>

# Mac/Linux
lsof -ti:3000 | xargs kill
```

### AI 任务一直 pending

Worker 未启动。在另一个终端运行：
```bash
npm run worker:ai
```

### Prisma dev 端口变化

Prisma dev 每次重启端口会变。本地开发建议使用 Docker Postgres：
```bash
docker compose up -d
# .env: DATABASE_URL=postgres://baoleme:baoleme_dev@localhost:15432/baoleme
```

### 如何停止

Ctrl+C 停止 trial:start，或：
```bash
# 手动停止
taskkill /F /IM node.exe     # Windows
pkill -f "next dev"          # Mac/Linux
pkill -f "ai-worker"
```

## 与生产环境的区别

- 本地试用使用 `npm run dev`，生产使用 `npm run start`（构建后）
- 本地使用 Prisma dev 或 Docker Postgres，生产必须独立 PostgreSQL
- 本地 JWT_SECRET 可用默认值，生产必须强随机
- 详见 `docs/21-production-trial.md`
