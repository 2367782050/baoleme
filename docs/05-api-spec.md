# API 契约

## 1. 通用约定

Base path:

- `/api`

认证：

- 登录后使用 httpOnly Cookie 保存 session。
- API 内部从 session 解析 `user_id`。
- 管理员接口需要 `role=admin` 或 `role=super_admin`。

成功响应：

```json
{
  "success": true,
  "data": {},
  "message": ""
}
```

失败响应：

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "参数错误",
    "details": {}
  }
}
```

常见错误码：

- `UNAUTHORIZED`
- `FORBIDDEN`
- `VALIDATION_ERROR`
- `NOT_FOUND`
- `QUOTA_EXCEEDED`
- `JOB_FAILED`
- `EXTERNAL_SERVICE_ERROR`
- `RATE_LIMITED`

## 2. Auth

### POST `/api/auth/register`

请求：

```json
{
  "username": "creator001",
  "email": "user@example.com",
  "password": "password123",
  "emailCode": "123456",
  "referralCode": "ABC123"
}
```

返回：

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "username": "creator001",
      "email": "user@example.com",
      "role": "user"
    }
  }
}
```

### POST `/api/auth/login`

请求：

```json
{
  "account": "creator001",
  "password": "password123"
}
```

### POST `/api/auth/logout`

清除 session。

### GET `/api/auth/me`

返回当前用户、会员、配额摘要。

### POST `/api/auth/send-email-code`

请求：

```json
{
  "email": "user@example.com",
  "purpose": "register"
}
```

## 3. Membership

### GET `/api/membership/plans`

返回所有启用套餐。

### GET `/api/membership/current`

返回当前会员、过期时间、权益。

### GET `/api/membership/quota`

返回当前用户各能力剩余配额。

### POST `/api/membership/redeem-code`

请求：

```json
{
  "code": "VIP202605"
}
```

行为：

- 校验会员码。
- 创建或延长会员。
- 写入审计日志。

## 4. Materials

### GET `/api/material/domains`

返回赛道/行业树。

### GET `/api/material/accounts`

查询参数：

- `platform`
- `domainId`
- `keyword`
- `page`
- `pageSize`
- `sortBy`
- `sortOrder`

返回字段：

```json
{
  "items": [
    {
      "id": "uuid",
      "platform": "wechat",
      "name": "示例公众号",
      "avatarUrl": "",
      "domainName": "财经",
      "avgTopReadCount": 100000,
      "avgReadCount": 30000,
      "postCountDaily": 3,
      "likeCountTotal": 20000,
      "originalIndex": 85.2,
      "rank": 1
    }
  ],
  "total": 100,
  "page": 1,
  "pageSize": 20
}
```

### GET `/api/material/articles`

查询文章素材。

### GET `/api/material/hot-topics`

查询热搜榜。

### POST `/api/material/favorites`

请求：

```json
{
  "targetType": "article",
  "targetId": "uuid"
}
```

### DELETE `/api/material/favorites/:id`

取消收藏。

### POST `/api/material/export`

请求：

```json
{
  "type": "accounts",
  "filters": {}
}
```

行为：

- 检查 `material_export` 配额。
- 生成 CSV/XLSX。
- 返回下载 URL。

## 5. Prompt Library

### GET `/api/prompt/groups`

返回当前用户提示词分组。

### POST `/api/prompt/groups`

创建分组。

### PUT `/api/prompt/groups/:id`

编辑分组。

### DELETE `/api/prompt/groups/:id`

删除分组。

### GET `/api/prompts`

查询参数：

- `groupId`
- `keyword`

### POST `/api/prompts`

手动创建提示词。

### PUT `/api/prompts/:id`

编辑提示词。

### DELETE `/api/prompts/:id`

删除提示词。

### POST `/api/prompts/generate`

请求：

```json
{
  "materialType": "url",
  "groupId": "uuid",
  "name": "财经爆款提示词",
  "referenceUrls": ["https://example.com/article"],
  "materialText": "",
  "authorName": "财经观察者",
  "personalityTraits": ["理性分析型", "犀利直接型"],
  "personaDetails": "长期关注宏观经济和普通人理财",
  "contentDomain": "财经理财",
  "targetAudience": ["职场人", "投资理财"],
  "headingStyle": "numbered",
  "wordCount": 1800,
  "enableAIDetectionEvasion": true
}
```

返回：

```json
{
  "jobId": "uuid",
  "status": "pending"
}
```

### GET `/api/prompts/generation-jobs/:id`

查询提示词生成状态。

## 6. Articles

### GET `/api/article/groups`

文章分组。

### GET `/api/articles`

查询参数：

- `groupId`
- `status`
- `pushStatus`
- `keyword`
- `page`
- `pageSize`

### POST `/api/articles/generate`

请求：

```json
{
  "title": "普通人如何抓住下一轮行业机会",
  "promptId": "uuid",
  "groupId": "uuid",
  "sourceUrl": "https://example.com/source",
  "referenceUrls": ["https://example.com/a", "https://example.com/b"],
  "materialText": "参考素材正文",
  "imageCount": 3,
  "imageStrategy": "relevant_collection",
  "needMaterial": true
}
```

返回：

```json
{
  "articleId": "uuid",
  "jobId": "uuid",
  "status": "pending"
}
```

### GET `/api/articles/:id`

文章详情。

### PUT `/api/articles/:id`

编辑标题、Markdown、HTML、封面、排版配置。

### DELETE `/api/articles/:id`

删除文章。

### GET `/api/articles/jobs/:id`

查询文章生成任务。

### POST `/api/articles/:id/push-draft`

请求：

```json
{
  "officialAccountId": "uuid",
  "coverUrl": "https://cdn.example.com/cover.png"
}
```

行为：

- 检查 `draft_push` 配额。
- 调用 `WeChatDraftAdapter`。
- 返回推送任务 ID。

## 7. Formatter

### POST `/api/formatter/render`

请求：

```json
{
  "markdown": "# 标题",
  "style": "green_tech",
  "themeColor": "#059669",
  "fontFamily": "Microsoft YaHei",
  "fontSize": 16,
  "lineHeight": 1.8,
  "paragraphSpacing": 18,
  "sidePadding": 16,
  "imageRounded": 8,
  "antiAI": false
}
```

返回：

```json
{
  "html": "<section>...</section>"
}
```

## 8. Official Accounts

### GET `/api/official-accounts`

返回授权公众号。

### POST `/api/official-accounts/mock`

首版创建 mock 公众号。

### POST `/api/official-accounts/authorize-url`

返回真实授权 URL。未配置微信开放平台时返回 `NOT_CONFIGURED`。

### DELETE `/api/official-accounts/:id`

删除授权账号。

## 9. Billing

### POST `/api/orders`

创建订单。首版可创建 mock 订单。

### GET `/api/orders`

查询当前用户订单。

### POST `/api/orders/:id/mock-pay`

开发环境使用，模拟支付成功。

## 10. Referral

### GET `/api/referral/summary`

返回推广链接、佣金、邀请人数、提现余额。

### GET `/api/referral/users`

邀请用户列表。

### GET `/api/referral/commissions`

佣金记录。

### POST `/api/referral/withdrawals`

提现申请。

## 11. Admin

### POST `/api/admin/material/import`

导入素材 CSV/XLSX。

### GET `/api/admin/users`

用户管理。

### POST `/api/admin/users/:id/membership`

手动开通会员。

### GET `/api/admin/jobs`

AI 任务监控。

### GET `/api/admin/withdrawals`

提现审核列表。

### POST `/api/admin/withdrawals/:id/review`

审核提现。

