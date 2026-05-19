# 爆了么功能复刻项目文档总览

这套文档用于指挥 Claude Code + DeepSeek V4 Pro 开发一个自媒体爆款创作系统。文档目标是让 Claude Code 不需要重新做产品判断，可以按阶段开发、汇报、验收和返工。

## 1. 两套体系必须分清

### 开发指挥体系

写给 Claude Code 使用。它规定开发顺序、任务边界、执行纪律、汇报格式和验收标准。

核心文档：

- `10-claude-code-command-center.md`
- `07-implementation-roadmap.md`
- `08-acceptance-tests.md`
- 根目录 `CLAUDE.md`

### 产品功能体系

写给产品和工程实现使用。它规定系统要做什么、接口是什么、数据怎么建模、产品 AI 创作能力怎么抽象。

核心文档：

- `01-prd.md`
- `02-research-breakdown.md`
- `03-system-architecture.md`
- `04-data-model.md`
- `05-api-spec.md`
- `06-ai-deepseek-jobs.md`
- `09-page-spec.md`

## 2. 文档目录

- `01-prd.md`：产品需求文档，定义目标用户、业务范围、页面、功能和优先级。
- `02-research-breakdown.md`：参考站点拆解，说明要复刻的功能路径和关键判断。
- `03-system-architecture.md`：系统架构，定义前后端、服务边界、外部适配层和部署形态。
- `04-data-model.md`：数据库实体、字段、状态枚举和关系。
- `05-api-spec.md`：前后端接口契约。
- `06-ai-deepseek-jobs.md`：产品 AI 创作引擎规范；文件名保留 DeepSeek，是历史命名，正文以 Provider 抽象为准。
- `07-implementation-roadmap.md`：Claude Code 分阶段开发路线和可复制阶段指令。
- `08-acceptance-tests.md`：验收测试、回归测试和上线前检查清单。
- `09-page-spec.md`：页面级规格，约束各页面信息架构和交互。
- `10-claude-code-command-center.md`：Claude Code + DeepSeek V4 Pro 开发指挥手册。

## 3. 当前产品策略

首版做“真实 AI 创作闭环 + 可替换外部服务适配层”：

- AI 创作必须真实可用，但产品后端只依赖 `AIProvider` 抽象，不强制绑定 DeepSeek。
- 素材榜单先用导入/种子数据/供应商适配，不做默认爬虫。
- 公众号草稿、支付、提现首版可 mock，但接口和数据模型必须按真实业务设计。
- UI 使用独立扁平化风格，不复制参考站点视觉资产。

## 4. Claude Code 读取顺序

每次开始开发前：

1. 先读根目录 `CLAUDE.md`。
2. 再读 `10-claude-code-command-center.md`。
3. 读 `07-implementation-roadmap.md`，只执行当前指定 Phase。
4. 按当前 Phase 需要读取 PRD、架构、数据模型、API、页面规格。
5. 涉及产品 AI 创作功能时读 `06-ai-deepseek-jobs.md`。
6. 完成后按 `08-acceptance-tests.md` 验收。

## 5. 总指挥工作流

项目采用“一阶段一指令”模式：

1. 总指挥给出当前 Phase 的 Claude Code 指令。
2. Claude Code 执行开发并按格式汇报。
3. 总指挥判断通过、返工、补文档或拆新任务。
4. 只有当前 Phase 验收通过后，才进入下一 Phase。

