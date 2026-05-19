# 系统架构说明

## 1. 架构目标

系统必须同时满足两件事：

1. 首版可以快速上线，完成真实 AI 创作闭环。
2. 后续可以替换素材数据源、支付、公众号授权、对象存储和 AI Provider，而不重写业务页面。

## 2. 推荐技术栈

- Web: Next.js App Router + TypeScript。
- UI: Tailwind CSS + 自定义组件。
- Database: PostgreSQL。
- ORM: Prisma 或 Drizzle，二选一后全项目统一。
- Queue: Redis + BullMQ。
- Cache: Redis。
- Object Storage: S3/R2/OSS 兼容 API。
- Auth: JWT + httpOnly Cookie，或 NextAuth/Auth.js。首版推荐自研轻量 JWT，减少第三方约束。
- AI: `AIProvider` 抽象接口。首版产品后端不强制绑定供应商，可实现 DeepSeek/OpenAI/通义/火山等任一适配器。

## 3. 模块边界

### 3.1 Web App

职责：

- 页面渲染。
- 表单交互。
- 列表筛选。
- 状态轮询。
- Markdown 编辑和 HTML 预览。

不得承担：

- AI 长任务执行。
- 直接操作数据库。
- 直接调用外部支付、微信、素材供应商。

### 3.2 API Layer

职责：

- 鉴权。
- 参数校验。
- 调用 domain service。
- 返回统一响应结构。

推荐响应格式：

```json
{
  "success": true,
  "data": {},
  "message": ""
}
```

错误响应：

```json
{
  "success": false,
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "今日文章生成次数已用完"
  }
}
```

### 3.3 Domain Services

核心服务：

- `AuthService`
- `MembershipService`
- `QuotaService`
- `MaterialService`
- `PromptService`
- `ArticleService`
- `FormatterService`
- `OfficialAccountService`
- `ReferralService`
- `AdminService`

Domain Service 只处理业务规则，不直接写 UI 逻辑。

### 3.4 Adapter Layer

所有外部能力必须通过 adapter 封装：

- `MaterialProvider`
- `AIProvider`
- `ArticleJobQueue`
- `WeChatDraftAdapter`
- `BillingAdapter`
- `StorageAdapter`
- `EmailAdapter`

首版可以提供 mock adapter，但接口必须接近真实业务。

## 4. 关键适配器

### 4.1 MaterialProvider

职责：

- 获取公众号榜单。
- 获取对标账号。
- 获取热搜。
- 获取文章素材。
- 支持导入数据。

首版实现：

- `SeedImportMaterialProvider`
- 从数据库读取后台导入的数据。

后续实现：

- `VendorMaterialProvider`
- `CompliantCrawlerMaterialProvider`

### 4.2 AIProvider

职责：

- 生成提示词。
- 生成文章。
- 解析素材。
- 总结 URL 或文本。

首版实现：

- `ConfigurableAIProvider` 或一个明确命名的供应商适配器。
- 如果团队选择 DeepSeek，可实现 `DeepSeekAIProvider`。
- 如果暂未确定供应商，可先实现 `MockAIProvider` + 接口测试，再替换真实 Provider。

必须支持：

- 超时控制。
- 失败重试。
- token 用量记录。
- 请求日志脱敏。

### 4.3 ArticleJobQueue

职责：

- 接收文章生成任务。
- 后台执行。
- 写入任务状态。
- 支持失败重试。

任务状态：

- `pending`
- `running`
- `completed`
- `failed`
- `cancelled`

### 4.4 WeChatDraftAdapter

职责：

- 发起公众号授权。
- 查询授权账号。
- 推送文章到草稿箱。
- 查询推送任务状态。

首版实现：

- `MockWeChatDraftAdapter`

真实实现条件：

- 微信开放平台资质。
- 授权回调域名。
- appid/appsecret。
- 图文草稿接口权限。

### 4.5 BillingAdapter

职责：

- 创建订单。
- 查询支付状态。
- 兑换会员码。
- 生成佣金。

首版实现：

- 会员码兑换。
- 管理后台手动开通。
- mock 支付订单。

## 5. 数据流

### 5.1 AI 文章生成

1. 用户提交文章生成表单。
2. API 校验登录态。
3. `QuotaService` 检查文章生成次数。
4. `ArticleService` 创建 article 和 article_job。
5. `ArticleJobQueue` 入队。
6. Worker 调用 `AIProvider.generateArticle`。
7. 成功后保存 Markdown、HTML、token 用量。
8. 扣减配额。
9. 前端轮询 job 状态并展示结果。

### 5.2 素材引用创作

1. 用户在素材库选择文章或账号。
2. 点击“引用创作”。
3. 系统把素材标题、摘要、URL、正文片段传入创作表单。
4. 用户选择提示词。
5. 提交生成任务。

### 5.3 会员配额检查

高价值操作前必须调用：

- `QuotaService.assertCanUse(userId, capability)`

操作成功后调用：

- `QuotaService.consume(userId, capability, amount)`

需要配额的能力：

- prompt_generate
- article_generate
- material_export
- image_upload
- draft_push
- official_account_bind

## 6. 权限模型

角色：

- `user`
- `admin`
- `super_admin`

权限规则：

- 普通用户只能访问自己的数据。
- 管理员可以访问运营后台。
- 超级管理员可以修改套餐、佣金比例和系统配置。

## 7. 部署建议

MVP 单体部署：

- Next.js Web + API。
- PostgreSQL。
- Redis。
- Worker 进程。
- Object Storage。

生产部署：

- Web/API 和 Worker 分离。
- 队列单独监控。
- 数据库自动备份。
- AI 请求日志脱敏。
- 管理后台加 IP 白名单或二次验证。

## 8. 可观测性

必须记录：

- 登录失败。
- 高价值操作。
- 配额消耗。
- AI 请求和失败。
- 支付状态变更。
- 公众号推送状态。
- 管理员操作。

推荐接入：

- 应用日志。
- 错误监控。
- 队列监控。
- 慢查询日志。
