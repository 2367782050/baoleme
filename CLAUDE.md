# BAOLEME Project Instructions for Claude Code

本仓库的文档用于指挥 Claude Code 开发一个“功能同构、独立实现”的自媒体爆款创作系统。参考对象是 `baolem.com` 的产品路径，但不得复制其代码、品牌、Logo、文案、素材、样式资产或私有数据。

## 1. 角色关系

请严格区分三层角色：

- **总指挥文档**：本仓库中的 PRD、架构、路线、验收和阶段任务书，是开发决策来源。
- **Claude Code**：真正执行开发的 coding agent，负责写代码、改文件、跑命令、修测试。
- **DeepSeek V4 Pro**：Claude Code 使用的底层开发模型，只代表“开发执行模型”，不等于产品后端必须使用 DeepSeek。

产品上线后的 AI 创作功能必须通过 `AIProvider` 抽象实现。首版 Provider 暂不绑定供应商，可以后续选择 DeepSeek、OpenAI、通义、火山或其他模型服务。

## 2. 进入仓库后的读取顺序

Claude Code 每次开始新阶段前必须按顺序阅读：

1. `docs/README.md`
2. `docs/10-claude-code-command-center.md`
3. `docs/07-implementation-roadmap.md` 中当前 Phase
4. `docs/01-prd.md`
5. `docs/03-system-architecture.md`
6. `docs/04-data-model.md`
7. `docs/05-api-spec.md`
8. 涉及产品 AI 功能时再读 `docs/06-ai-deepseek-jobs.md`
9. 完成后按 `docs/08-acceptance-tests.md` 验收

## 3. 技术默认值

- Frontend: Next.js App Router + TypeScript。
- Styling: Tailwind CSS + 自定义扁平化产品设计。
- Backend: Next.js Route Handlers 或独立 Node 服务均可，但接口必须符合文档。
- Database: PostgreSQL。
- Queue: Redis-backed queue, BullMQ 或同等能力。
- Object Storage: S3/R2/OSS 兼容接口。
- Product AI: `AIProvider` 抽象，首版不强制绑定 DeepSeek。

## 4. 必须实现的业务边界

必须实现：

- 登录注册、邀请码、会员状态、配额。
- 爆款素材、榜单、热搜、对标号、收藏、导出、引用创作。
- 提示词库、提示词生成、分组管理。
- 智能创作、异步任务、状态轮询、失败重试。
- 一键排版、Markdown 编辑、HTML 预览、复制到公众号编辑器。
- 公众号管理、支付、推广返佣的适配层和 mock 实现。
- 后台运营入口：素材导入、会员开通、订单/佣金审核。

首版不要求真实接通：

- 微信开放平台授权。
- 微信草稿箱真实推送。
- 微信/支付宝真实支付。
- 自动提现。
- 自建爬虫。

## 5. 禁止事项

- 不要抓取或复用参考站点的私有 JS、图片、Logo、数据。
- 不要把外部爬虫作为 MVP 的默认实现。
- 不要把 AI 生成做成同步阻塞接口；必须走任务状态。
- 不要把 Claude Code 的 DeepSeek 开发模型误写成产品后端固定 Provider。
- 不要只做静态页面；核心流程必须可交互、可验收。
- 不要在没有凭证的情况下伪装真实支付、真实公众号授权或真实提现。

## 6. 开发纪律

本项目采用“一阶段一指令”模式。每次只执行 `docs/07-implementation-roadmap.md` 中一个 Phase，不得跨阶段扩展。

每个 Phase 完成后必须汇报：

```text
Phase:
完成内容:
修改文件:
运行命令:
测试结果:
未完成/风险:
下一步建议:
```

如果遇到阻塞，不要猜测继续开发。请按 `docs/10-claude-code-command-center.md` 的“阻塞回传格式”输出问题，等待总指挥给新指令。

