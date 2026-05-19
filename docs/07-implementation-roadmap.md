# Claude Code 分阶段开发路线

## 1. 总原则

本路线写给 Claude Code 执行。Claude Code 的底层模型是 DeepSeek V4 Pro，但产品后端 AI 功能必须通过 `AIProvider` 抽象实现，不强制绑定 DeepSeek。

开发顺序必须服务业务闭环，不要先做漂亮但不可用的页面。

推荐顺序：

1. 项目骨架。
2. 数据模型。
3. 鉴权和会员配额。
4. 素材库。
5. 提示词库。
6. AIProvider 创作能力。
7. 一键排版。
8. 公众号、支付、推广 mock。
9. 后台运营。
10. 端到端验收。

每个阶段完成后必须运行测试并按 `docs/10-claude-code-command-center.md` 的格式汇报。

## 2. 通用 Claude Code 指令模板

每个 Phase 都必须从这段开始：

```text
你是本项目的 Claude Code 执行者，当前底层模型是 DeepSeek V4 Pro。

请先阅读：
- CLAUDE.md
- docs/README.md
- docs/10-claude-code-command-center.md
- docs/07-implementation-roadmap.md

本次只执行我指定的 Phase，不要跨阶段实现功能。

注意：DeepSeek V4 Pro 是你的开发模型，不代表产品后端 AI Provider 必须使用 DeepSeek。产品 AI 功能必须按 AIProvider 抽象实现。
```

## 3. Phase 0：项目初始化

目标：

- 创建 Next.js App Router + TypeScript 项目。
- 配置 Tailwind。
- 配置 lint、format、test、typecheck。
- 建立基础目录结构。

推荐目录：

```text
app/
  (public)/
  (dashboard)/
  api/
components/
  ui/
  layout/
  feature/
lib/
  auth/
  db/
  services/
  adapters/
  queue/
  validation/
  utils/
workers/
prisma/ 或 db/
tests/
```

验收：

- 首页可访问。
- `/login`、`/register`、`/dashboard` 路由存在。
- `npm run lint` 通过。
- `npm run typecheck` 通过。
- `npm run build` 通过。

### 可复制给 Claude Code 的指令

```text
你是本项目的 Claude Code 执行者，当前底层模型是 DeepSeek V4 Pro。

本次只执行 Phase 0：项目初始化。

必读文档：
- CLAUDE.md
- docs/README.md
- docs/10-claude-code-command-center.md
- docs/07-implementation-roadmap.md
- docs/09-page-spec.md

开发目标：
- 创建 Next.js App Router + TypeScript 项目。
- 配置 Tailwind、lint、format、test、typecheck。
- 建立 app、components、lib、workers、tests 等基础目录。
- 创建首页、登录页、注册页、dashboard 占位页。

允许修改：
- package.json
- Next.js/Tailwind/TypeScript 配置
- app/
- components/
- lib/
- tests/

禁止事项：
- 不要实现登录业务。
- 不要实现数据库。
- 不要实现 AI、支付、公众号、素材库。
- 不要改写 docs/ 文档。

验收命令：
- npm run lint
- npm run typecheck
- npm run build

完成后按 docs/10-claude-code-command-center.md 的格式汇报。
```

## 4. Phase 1：数据库与领域模型

目标：

- 按 `04-data-model.md` 建立核心表。
- 增加 seed 脚本。
- 写基础 repository/service。

必须包含：

- users
- membership_plans
- user_memberships
- quota_usage
- material_domains
- material_accounts
- material_articles
- prompt_groups
- prompts
- article_groups
- articles
- article_generation_jobs

验收：

- 数据库迁移成功。
- seed 后有默认套餐、行业、素材样例。
- service 层单测覆盖创建用户、查询套餐、检查配额。

### 可复制给 Claude Code 的指令

```text
你是本项目的 Claude Code 执行者，当前底层模型是 DeepSeek V4 Pro。

本次只执行 Phase 1：数据库与领域模型。

必读文档：
- CLAUDE.md
- docs/README.md
- docs/10-claude-code-command-center.md
- docs/03-system-architecture.md
- docs/04-data-model.md
- docs/08-acceptance-tests.md

开发目标：
- 选择并配置项目 ORM，优先 Prisma 或 Drizzle，确定后全项目统一。
- 按 docs/04-data-model.md 建立核心表和枚举。
- 增加 seed 脚本，生成默认套餐、行业、素材样例和管理员账号。
- 建立基础 repository/service 层。

允许修改：
- 数据库/ORM 配置
- lib/db/
- lib/services/
- prisma/ 或 db/
- tests/
- package.json 中必要脚本

禁止事项：
- 不要实现登录 UI 之外的业务页面。
- 不要接真实外部服务。
- 不要改变 docs/04-data-model.md 的业务含义；发现冲突时按 BLOCKED 格式汇报。

验收命令：
- npm run lint
- npm run typecheck
- npm run test
- 数据库迁移命令
- seed 命令

完成后按 docs/10-claude-code-command-center.md 的格式汇报。
```

## 5. Phase 2：鉴权、会员和配额

目标：

- 注册。
- 登录。
- 当前用户。
- 会员状态。
- 配额检查和扣减。

页面：

- 登录页。
- 注册页。
- 会员中心基础页。

接口：

- `/api/auth/register`
- `/api/auth/login`
- `/api/auth/logout`
- `/api/auth/me`
- `/api/membership/plans`
- `/api/membership/current`
- `/api/membership/quota`

验收：

- 新用户可注册登录。
- 用户默认获得配置的初始会员。
- 过期会员不能使用高价值能力。
- 配额不足返回 `QUOTA_EXCEEDED`。

### 可复制给 Claude Code 的指令

```text
你是本项目的 Claude Code 执行者，当前底层模型是 DeepSeek V4 Pro。

本次只执行 Phase 2：鉴权、会员和配额。

必读文档：
- CLAUDE.md
- docs/README.md
- docs/10-claude-code-command-center.md
- docs/01-prd.md
- docs/04-data-model.md
- docs/05-api-spec.md
- docs/08-acceptance-tests.md
- docs/09-page-spec.md

开发目标：
- 实现注册、登录、退出和当前用户接口。
- 实现会员套餐查询、当前会员、配额查询。
- 实现 QuotaService，支持 assertCanUse 和 consume。
- 完成登录页、注册页、会员中心基础页。

允许修改：
- app/(public)/login 或对应路由
- app/(public)/register 或对应路由
- app/(dashboard)/membership 或对应路由
- app/api/auth/
- app/api/membership/
- lib/auth/
- lib/services/
- tests/

禁止事项：
- 不要实现支付。
- 不要实现会员码兑换，除非 Phase 1 已经完整支持且文档明确要求。
- 不要实现素材库、AI 创作、公众号。

验收命令：
- npm run lint
- npm run typecheck
- npm run test
- npm run build

完成后按 docs/10-claude-code-command-center.md 的格式汇报。
```

## 6. Phase 3：素材库

目标：

- 实现素材数据查询、筛选、收藏、导出。
- 实现后台导入种子数据。

页面：

- 爆款素材。
- 对标账号。
- 热搜榜。

接口：

- `/api/material/domains`
- `/api/material/accounts`
- `/api/material/articles`
- `/api/material/hot-topics`
- `/api/material/favorites`
- `/api/material/export`
- `/api/admin/material/import`

验收：

- 能按行业、关键词、平台筛选。
- 能收藏和取消收藏。
- 能导出 CSV/XLSX。
- 导出会扣减配额。
- 能从素材进入创作页并带入标题/URL/摘要。

### 可复制给 Claude Code 的指令

```text
你是本项目的 Claude Code 执行者，当前底层模型是 DeepSeek V4 Pro。

本次只执行 Phase 3：素材库。

必读文档：
- CLAUDE.md
- docs/README.md
- docs/10-claude-code-command-center.md
- docs/01-prd.md
- docs/02-research-breakdown.md
- docs/04-data-model.md
- docs/05-api-spec.md
- docs/08-acceptance-tests.md
- docs/09-page-spec.md

开发目标：
- 实现 MaterialProvider 抽象，首版使用数据库导入/种子数据 Provider。
- 实现公众号榜单、精品对标号、热搜榜、文章素材列表。
- 实现筛选、搜索、分页、收藏、取消收藏。
- 实现导出 CSV/XLSX，并扣减 material_export 配额。
- 实现从素材跳转到创作表单的参数传递。

允许修改：
- app/(dashboard)/materials 或对应路由
- app/api/material/
- app/api/admin/material/
- lib/adapters/material/
- lib/services/material*
- tests/

禁止事项：
- 不要写自建爬虫。
- 不要抓取 baolem.com 私有数据。
- 不要接真实第三方素材供应商，除非另有总指挥指令。

验收命令：
- npm run lint
- npm run typecheck
- npm run test
- npm run build

完成后按 docs/10-claude-code-command-center.md 的格式汇报。
```

## 7. Phase 4：提示词库

目标：

- 分组管理。
- 提示词增删改查。
- 通过 AIProvider 生成提示词。

页面：

- 提示词库。
- 生成提示词弹窗或页面。

接口：

- `/api/prompt/groups`
- `/api/prompts`
- `/api/prompts/generate`
- `/api/prompts/generation-jobs/:id`

验收：

- 用户只能看到自己的提示词。
- URL 和文本两种素材输入可用。
- 生成成功后自动保存提示词。
- 生成失败展示原因。
- 生成次数会扣减配额。

### 可复制给 Claude Code 的指令

```text
你是本项目的 Claude Code 执行者，当前底层模型是 DeepSeek V4 Pro。

本次只执行 Phase 4：提示词库。

必读文档：
- CLAUDE.md
- docs/README.md
- docs/10-claude-code-command-center.md
- docs/01-prd.md
- docs/04-data-model.md
- docs/05-api-spec.md
- docs/06-ai-deepseek-jobs.md
- docs/08-acceptance-tests.md
- docs/09-page-spec.md

开发目标：
- 实现提示词分组 CRUD。
- 实现提示词 CRUD。
- 实现 AIProvider 抽象在提示词生成中的调用。
- 默认提供 MockAIProvider；如 AI_* 环境变量完整，允许走 OpenAI-compatible Provider。
- 实现提示词生成任务状态查询、失败原因展示和 prompt_generate 配额扣减。

允许修改：
- app/(dashboard)/prompts 或对应路由
- app/api/prompt/
- app/api/prompts/
- lib/adapters/ai/
- lib/services/prompt*
- lib/queue/
- workers/
- tests/

禁止事项：
- 不要把产品 AI Provider 写死为 DeepSeek。
- 不要把 Claude Code 的 ANTHROPIC_* 环境变量用于产品后端。
- 不要同步阻塞等待长任务完成。

验收命令：
- npm run lint
- npm run typecheck
- npm run test
- npm run build

完成后按 docs/10-claude-code-command-center.md 的格式汇报。
```

## 8. Phase 5：智能创作

目标：

- 通过 AIProvider 生成文章。
- 异步任务队列。
- 文章列表、状态轮询、编辑、删除。

页面：

- 智能创作。
- 新建创作表单。
- 文章详情/编辑。

接口：

- `/api/article/groups`
- `/api/articles`
- `/api/articles/generate`
- `/api/articles/:id`
- `/api/articles/jobs/:id`

验收：

- 用户选择提示词和素材后可生成文章。
- 任务状态从 pending/running 到 completed/failed。
- 失败任务可重试。
- 成功文章有 Markdown 内容。
- 每日文章生成次数会扣减。

### 可复制给 Claude Code 的指令

```text
你是本项目的 Claude Code 执行者，当前底层模型是 DeepSeek V4 Pro。

本次只执行 Phase 5：智能创作。

必读文档：
- CLAUDE.md
- docs/README.md
- docs/10-claude-code-command-center.md
- docs/01-prd.md
- docs/04-data-model.md
- docs/05-api-spec.md
- docs/06-ai-deepseek-jobs.md
- docs/08-acceptance-tests.md
- docs/09-page-spec.md

开发目标：
- 实现文章分组、文章列表、文章详情、编辑、删除。
- 实现文章生成任务：创建任务、入队、执行、状态轮询、失败重试。
- 使用 AIProvider 完成素材分析、文章生成、质检和必要时重写。
- 默认支持 MockAIProvider；如配置真实 AI_PROVIDER，则走真实 Provider。
- 实现 article_generate 配额检查和扣减。

允许修改：
- app/(dashboard)/writing 或对应路由
- app/api/article/
- app/api/articles/
- lib/adapters/ai/
- lib/services/article*
- lib/queue/
- workers/
- tests/

禁止事项：
- 不要把 AI 文章生成做成同步请求。
- 不要把产品 AI Provider 写死为 DeepSeek。
- 不要实现一键排版、公众号推送、支付。

验收命令：
- npm run lint
- npm run typecheck
- npm run test
- npm run build

完成后按 docs/10-claude-code-command-center.md 的格式汇报。
```

## 9. Phase 6：一键排版

目标：

- Markdown 编辑。
- HTML 预览。
- 样式模板。
- 复制 HTML。
- 保存排版配置。

页面：

- 一键排版。

接口：

- `/api/formatter/render`
- `/api/articles/:id`
- `/api/files/upload`

验收：

- 从文章进入排版页能加载内容。
- 编辑 Markdown 后预览更新。
- 模板、颜色、字体、字号、行距、段距生效。
- 复制 HTML 可粘贴到微信公众号编辑器。
- 保存后再次打开配置不丢失。

### 可复制给 Claude Code 的指令

```text
你是本项目的 Claude Code 执行者，当前底层模型是 DeepSeek V4 Pro。

本次只执行 Phase 6：一键排版。

必读文档：
- CLAUDE.md
- docs/README.md
- docs/10-claude-code-command-center.md
- docs/01-prd.md
- docs/05-api-spec.md
- docs/08-acceptance-tests.md
- docs/09-page-spec.md

开发目标：
- 实现 Markdown 编辑器和公众号文章预览。
- 实现模板、主题色、字体、字号、行距、段距、边距、图片圆角设置。
- 实现 formatter/render 接口。
- 实现保存文章排版配置。
- 实现复制 HTML 到剪贴板。

允许修改：
- app/(dashboard)/formatter 或对应路由
- app/api/formatter/
- app/api/files/
- lib/services/formatter*
- components/feature/formatter/
- tests/

禁止事项：
- 不要实现真实公众号推送。
- 不要做大型视觉重构。
- 不要引入不必要的富文本重量级依赖，除非有明确理由。

验收命令：
- npm run lint
- npm run typecheck
- npm run test
- npm run build

完成后按 docs/10-claude-code-command-center.md 的格式汇报。
```

## 10. Phase 7：公众号、支付、推广 mock

目标：

- 完成真实业务的数据模型和 mock 流程。
- 不要求真实外部打通。

功能：

- 创建 mock 公众号。
- mock 推送草稿。
- mock 订单支付。
- 会员码兑换。
- 邀请码归因。
- 佣金生成。
- 提现申请。

验收：

- 公众号数量受会员配额限制。
- 草稿推送会创建推送任务。
- mock 支付成功后会员生效。
- 被邀请用户支付后生成佣金。
- 用户可提交提现申请。

### 可复制给 Claude Code 的指令

```text
你是本项目的 Claude Code 执行者，当前底层模型是 DeepSeek V4 Pro。

本次只执行 Phase 7：公众号、支付、推广 mock。

必读文档：
- CLAUDE.md
- docs/README.md
- docs/10-claude-code-command-center.md
- docs/01-prd.md
- docs/04-data-model.md
- docs/05-api-spec.md
- docs/08-acceptance-tests.md
- docs/09-page-spec.md

开发目标：
- 实现 WeChatDraftAdapter 抽象和 MockWeChatDraftAdapter。
- 实现 BillingAdapter 抽象和 mock 订单支付。
- 实现会员码兑换。
- 实现邀请码归因、佣金生成、提现申请。
- 完成公众号管理、会员中心、推广中心相关页面。

允许修改：
- app/(dashboard)/official-accounts 或对应路由
- app/(dashboard)/membership 或对应路由
- app/(dashboard)/referral 或对应路由
- app/api/official-accounts/
- app/api/orders/
- app/api/referral/
- lib/adapters/wechat/
- lib/adapters/billing/
- lib/services/referral*
- tests/

禁止事项：
- 不要接真实微信开放平台。
- 不要接真实微信/支付宝支付。
- 不要实现自动提现。
- 不要伪装 mock 为真实成功。

验收命令：
- npm run lint
- npm run typecheck
- npm run test
- npm run build

完成后按 docs/10-claude-code-command-center.md 的格式汇报。
```

## 11. Phase 8：后台运营

目标：

- 管理用户。
- 管理会员。
- 导入素材。
- 查看 AI 任务。
- 审核提现。

验收：

- 非管理员无法访问后台。
- 管理员可导入素材。
- 管理员可手动开通会员。
- 管理员可查看失败任务和错误原因。
- 管理员可审核提现。

### 可复制给 Claude Code 的指令

```text
你是本项目的 Claude Code 执行者，当前底层模型是 DeepSeek V4 Pro。

本次只执行 Phase 8：后台运营。

必读文档：
- CLAUDE.md
- docs/README.md
- docs/10-claude-code-command-center.md
- docs/01-prd.md
- docs/04-data-model.md
- docs/05-api-spec.md
- docs/08-acceptance-tests.md
- docs/09-page-spec.md

开发目标：
- 实现管理员鉴权。
- 实现用户管理、会员管理、素材导入、AI 任务查看、订单管理、提现审核。
- 管理操作写入 audit_logs。
- 导入素材支持行级错误反馈。

允许修改：
- app/(dashboard)/admin 或对应路由
- app/api/admin/
- lib/auth/
- lib/services/admin*
- tests/

禁止事项：
- 不要让普通用户访问后台数据。
- 不要做自动打款。
- 不要接真实外部素材供应商。

验收命令：
- npm run lint
- npm run typecheck
- npm run test
- npm run build

完成后按 docs/10-claude-code-command-center.md 的格式汇报。
```

## 12. Phase 9：端到端整理

目标：

- 修复跨模块问题。
- 打磨 UI。
- 完成测试。
- 准备部署。

必须验证完整路径：

1. 注册。
2. 登录。
3. 查看素材。
4. 收藏素材。
5. 生成提示词。
6. 生成文章。
7. 排版。
8. 复制 HTML。
9. mock 推送公众号草稿。
10. 查看配额扣减。

### 可复制给 Claude Code 的指令

```text
你是本项目的 Claude Code 执行者，当前底层模型是 DeepSeek V4 Pro。

本次只执行 Phase 9：端到端整理。

必读文档：
- CLAUDE.md
- docs/README.md
- docs/10-claude-code-command-center.md
- docs/01-prd.md
- docs/05-api-spec.md
- docs/08-acceptance-tests.md
- docs/09-page-spec.md

开发目标：
- 跑通注册、登录、素材、提示词、文章生成、排版、复制 HTML、mock 草稿推送、配额扣减的完整路径。
- 修复跨模块 bug。
- 补齐缺失测试。
- 整理部署前配置说明。

允许修改：
- 全项目中与端到端缺陷直接相关的文件。
- 测试文件。
- 必要的配置示例。

禁止事项：
- 不要新增大功能。
- 不要改产品范围。
- 不要接真实支付、真实微信授权、真实爬虫。

验收命令：
- npm run lint
- npm run typecheck
- npm run test
- npm run build
- 端到端测试命令，若项目已配置

完成后按 docs/10-claude-code-command-center.md 的格式汇报。
```

## 13. 不要提前做的事

- 不要先做真实爬虫。
- 不要先做真实支付。
- 不要先做真实微信开放平台。
- 不要把后台做成独立大系统。
- 不要为了视觉复杂度牺牲工具效率。
- 不要把 Claude Code 的 DeepSeek V4 Pro 开发模型写成产品后端固定 AI Provider。

