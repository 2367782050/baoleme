# 数据模型设计

本文档定义 PostgreSQL 数据模型。字段名使用 snake_case。所有表建议包含：

- `id`
- `created_at`
- `updated_at`

软删除表增加：

- `deleted_at`

## 1. 用户与权限

### users

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 用户 ID |
| username | varchar(50) | 用户名，唯一 |
| email | varchar(255) | 邮箱，唯一 |
| password_hash | text | 密码哈希 |
| role | varchar(20) | user/admin/super_admin |
| avatar_url | text | 头像 |
| referral_code | varchar(32) | 自己的邀请码，唯一 |
| referred_by_user_id | uuid | 邀请人 |
| status | varchar(20) | active/disabled |
| last_login_at | timestamptz | 最近登录时间 |

### email_verification_codes

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | ID |
| email | varchar(255) | 邮箱 |
| code_hash | text | 验证码哈希 |
| purpose | varchar(30) | register/reset_password |
| expires_at | timestamptz | 过期时间 |
| consumed_at | timestamptz | 使用时间 |

### audit_logs

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | ID |
| user_id | uuid | 操作人 |
| action | varchar(100) | 操作名称 |
| target_type | varchar(50) | 对象类型 |
| target_id | uuid | 对象 ID |
| metadata | jsonb | 脱敏元数据 |
| ip | inet | IP |

## 2. 会员与配额

### membership_plans

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | ID |
| code | varchar(50) | 套餐编码 |
| name | varchar(100) | 套餐名称 |
| price_cents | int | 售价，分 |
| original_price_cents | int | 原价，分 |
| duration_days | int | 有效天数 |
| is_active | boolean | 是否启用 |
| capabilities | jsonb | 套餐权益 |

`capabilities` 示例：

```json
{
  "prompt_generate_monthly": 30,
  "article_generate_daily": 20,
  "material_export_daily": 1000,
  "image_upload_daily": 50,
  "draft_push_daily": 100,
  "official_account_limit": 20
}
```

### user_memberships

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | ID |
| user_id | uuid | 用户 |
| plan_id | uuid | 套餐 |
| starts_at | timestamptz | 开始时间 |
| expires_at | timestamptz | 过期时间 |
| status | varchar(20) | active/expired/cancelled |
| source | varchar(30) | trial/order/code/admin |

### quota_usage

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | ID |
| user_id | uuid | 用户 |
| capability | varchar(50) | 能力 |
| period_type | varchar(20) | daily/monthly/lifetime |
| period_key | varchar(20) | 2026-05-17 或 2026-05 |
| used | int | 已用次数 |

联合唯一索引：

- `user_id + capability + period_type + period_key`

## 3. 素材与榜单

### material_domains

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | ID |
| name | varchar(100) | 赛道/行业名称 |
| parent_id | uuid | 父级 |
| sort_order | int | 排序 |

### material_accounts

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | ID |
| platform | varchar(50) | wechat/xiaohongshu/douyin/toutiao |
| name | varchar(255) | 账号名称 |
| external_id | varchar(255) | 外部 ID |
| avatar_url | text | 头像 |
| domain_id | uuid | 行业 |
| avg_top_read_count | int | 头条平均阅读 |
| avg_read_count | int | 平均阅读 |
| post_count_daily | numeric | 日发文数 |
| like_count_total | int | 总点赞 |
| original_index | numeric | 原创指数 |
| rank | int | 榜单排名 |
| source_provider | varchar(50) | seed/vendor/import |
| snapshot_date | date | 榜单日期 |

### material_articles

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | ID |
| platform | varchar(50) | 平台 |
| account_id | uuid | 账号 |
| domain_id | uuid | 行业 |
| title | varchar(500) | 标题 |
| source_url | text | 来源链接 |
| summary | text | 摘要 |
| content_excerpt | text | 正文片段 |
| cover_url | text | 封面 |
| read_count | int | 阅读数 |
| like_count | int | 点赞数 |
| comment_count | int | 评论数 |
| published_at | timestamptz | 发布时间 |
| source_provider | varchar(50) | 来源 |

### hot_topics

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | ID |
| platform | varchar(50) | 平台 |
| title | varchar(500) | 标题 |
| url | text | 链接 |
| rank | int | 排名 |
| heat_score | numeric | 热度 |
| snapshot_at | timestamptz | 快照时间 |

### favorites

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | ID |
| user_id | uuid | 用户 |
| target_type | varchar(30) | account/article/topic/prompt |
| target_id | uuid | 目标 ID |

## 4. 提示词

### prompt_groups

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | ID |
| user_id | uuid | 用户 |
| name | varchar(100) | 分组名 |
| description | text | 描述 |

### prompts

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | ID |
| user_id | uuid | 用户 |
| group_id | uuid | 分组 |
| name | varchar(200) | 提示词名称 |
| content | text | 提示词内容 |
| source_type | varchar(30) | manual/generated |
| config | jsonb | 生成配置 |

### prompt_generation_jobs

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | ID |
| user_id | uuid | 用户 |
| group_id | uuid | 分组 |
| status | varchar(20) | pending/running/completed/failed |
| input | jsonb | 输入参数 |
| output_prompt_id | uuid | 生成的提示词 |
| error_message | text | 失败原因 |
| token_usage | jsonb | token 用量 |

## 5. 文章与排版

### article_groups

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | ID |
| user_id | uuid | 用户 |
| name | varchar(100) | 分组名 |
| description | text | 描述 |

### articles

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | ID |
| user_id | uuid | 用户 |
| group_id | uuid | 分组 |
| prompt_id | uuid | 提示词 |
| title | varchar(500) | 标题 |
| markdown_content | text | Markdown |
| html_content | text | HTML |
| cover_url | text | 封面 |
| status | varchar(20) | draft/generating/completed/failed |
| push_status | varchar(20) | not_pushed/pushing/pushed/failed |
| generation_config | jsonb | 生成配置 |
| formatter_config | jsonb | 排版配置 |

### article_generation_jobs

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | ID |
| user_id | uuid | 用户 |
| article_id | uuid | 文章 |
| status | varchar(20) | pending/running/completed/failed/cancelled |
| input | jsonb | 生成输入 |
| error_message | text | 失败原因 |
| attempts | int | 尝试次数 |
| started_at | timestamptz | 开始时间 |
| completed_at | timestamptz | 完成时间 |
| token_usage | jsonb | token 用量 |

## 6. 公众号

### official_account_groups

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | ID |
| user_id | uuid | 用户 |
| name | varchar(100) | 分组名 |

### official_accounts

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | ID |
| user_id | uuid | 用户 |
| group_id | uuid | 分组 |
| appid | varchar(100) | 公众号 appid |
| name | varchar(255) | 公众号名称 |
| avatar_url | text | 头像 |
| status | varchar(30) | mock_authorized/authorized/expired/revoked |
| auth_payload | jsonb | 授权信息，需加密或脱敏 |

### draft_push_tasks

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | ID |
| user_id | uuid | 用户 |
| article_id | uuid | 文章 |
| official_account_id | uuid | 公众号 |
| status | varchar(20) | pending/running/completed/failed |
| external_draft_id | varchar(255) | 外部草稿 ID |
| error_message | text | 失败原因 |

## 7. 支付与推广

### orders

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | ID |
| user_id | uuid | 用户 |
| plan_id | uuid | 套餐 |
| order_no | varchar(64) | 订单号 |
| amount_cents | int | 金额 |
| status | varchar(20) | pending/paid/cancelled/refunded |
| payment_provider | varchar(30) | mock/wechat/alipay |
| paid_at | timestamptz | 支付时间 |

### membership_codes

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | ID |
| code_hash | text | 会员码哈希 |
| plan_id | uuid | 套餐 |
| status | varchar(20) | unused/used/disabled |
| used_by_user_id | uuid | 使用者 |
| used_at | timestamptz | 使用时间 |

### referral_commissions

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | ID |
| referrer_user_id | uuid | 推广人 |
| referred_user_id | uuid | 被邀请人 |
| order_id | uuid | 订单 |
| amount_cents | int | 佣金 |
| rate | numeric | 佣金比例 |
| status | varchar(20) | pending/available/withdrawn/cancelled |

### withdrawal_requests

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | ID |
| user_id | uuid | 用户 |
| amount_cents | int | 提现金额 |
| fee_cents | int | 手续费 |
| alipay_name | varchar(100) | 支付宝姓名 |
| alipay_account | varchar(255) | 支付宝账号 |
| status | varchar(20) | pending/approved/rejected/paid |
| reviewed_by_user_id | uuid | 审核人 |
| reviewed_at | timestamptz | 审核时间 |

## 8. 文件

### files

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | ID |
| user_id | uuid | 上传者 |
| bucket | varchar(100) | bucket |
| object_key | text | 对象 key |
| public_url | text | 访问 URL |
| mime_type | varchar(100) | MIME |
| size_bytes | bigint | 文件大小 |
| purpose | varchar(50) | cover/image/import |

