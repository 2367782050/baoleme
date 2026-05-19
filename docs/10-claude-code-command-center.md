# Claude Code + DeepSeek V4 Pro 开发指挥手册

## 1. 本文件用途

本文件写给 Claude Code。它定义开发执行纪律、阶段任务格式、汇报格式、阻塞回传格式和验收方式。

本项目的工作模式是：

1. 总指挥维护 PRD、架构、路线和验收文档。
2. 用户把阶段指令复制给 Claude Code。
3. Claude Code 按阶段执行开发。
4. Claude Code 汇报结果或阻塞。
5. 总指挥判断通过、返工或拆分下一阶段。

Claude Code 不负责重新定义产品方向，也不负责跳阶段做“大而全”的实现。

## 2. 角色边界

### Claude Code 是执行者

负责：

- 写代码。
- 改文件。
- 跑命令。
- 修测试。
- 按文档实现功能。
- 按格式汇报。

不负责：

- 擅自改产品范围。
- 擅自更换技术栈。
- 擅自接真实支付、真实公众号授权或真实爬虫。
- 擅自把开发模型 DeepSeek V4 Pro 写成产品后端固定 AI Provider。

### DeepSeek V4 Pro 是开发模型

DeepSeek V4 Pro 是 Claude Code 的底层模型，用来辅助开发。它不是业务系统的一部分。

产品内部 AI 创作功能必须按 `docs/06-ai-deepseek-jobs.md` 的 `AIProvider` 抽象实现，首版不强制绑定 DeepSeek。

## 3. Claude Code 环境建议

如果使用 DeepSeek V4 Pro 作为 Claude Code 模型，可在 PowerShell 设置：

```powershell
$env:ANTHROPIC_BASE_URL="https://api.deepseek.com/anthropic"
$env:ANTHROPIC_AUTH_TOKEN="<your DeepSeek API Key>"
$env:ANTHROPIC_MODEL="deepseek-v4-pro[1m]"
$env:ANTHROPIC_DEFAULT_OPUS_MODEL="deepseek-v4-pro[1m]"
$env:ANTHROPIC_DEFAULT_SONNET_MODEL="deepseek-v4-pro[1m]"
$env:ANTHROPIC_DEFAULT_HAIKU_MODEL="deepseek-v4-flash"
$env:CLAUDE_CODE_SUBAGENT_MODEL="deepseek-v4-flash"
$env:CLAUDE_CODE_EFFORT_LEVEL="max"
```

注意：

- 不要把这些环境变量提交到仓库。
- 不要把 `ANTHROPIC_AUTH_TOKEN` 写入 `.env.example`。
- 产品后端环境变量使用 `AI_*`，不要复用 Claude Code 的 `ANTHROPIC_*`。

## 4. 每次开始前必须做

Claude Code 收到阶段任务后，先执行：

1. 阅读根目录 `CLAUDE.md`。
2. 阅读 `docs/README.md`。
3. 阅读本文件。
4. 阅读 `docs/07-implementation-roadmap.md` 中指定 Phase。
5. 阅读该 Phase 依赖的产品、架构、数据、API、页面和验收文档。
6. 检查当前工作区是否已有未完成代码。
7. 输出简短执行计划，再开始改文件。

## 5. 阶段任务标准模板

总指挥给 Claude Code 的任务应使用这个结构：

```text
你是本项目的 Claude Code 执行者，当前底层模型是 DeepSeek V4 Pro。

本次只执行 Phase X：<阶段名称>。

必读文档：
- CLAUDE.md
- docs/README.md
- docs/10-claude-code-command-center.md
- docs/07-implementation-roadmap.md
- <本阶段相关文档>

开发目标：
- <目标1>
- <目标2>

允许修改：
- <目录或文件范围>

禁止事项：
- 不要执行其他 Phase。
- 不要重写无关文档。
- 不要擅自改变技术栈。
- 不要把 Claude Code 的 DeepSeek 开发模型写成产品后端固定 Provider。

验收命令：
- <命令1>
- <命令2>

完成后按以下格式汇报：
Phase:
完成内容:
修改文件:
运行命令:
测试结果:
未完成/风险:
下一步建议:
```

## 6. Claude Code 完成汇报格式

每个 Phase 完成后必须输出：

```text
Phase:

完成内容:
- 

修改文件:
- 

运行命令:
- 

测试结果:
- 

未完成/风险:
- 

下一步建议:
- 
```

如果某个验收命令失败，必须写清楚：

- 失败命令。
- 失败输出的关键部分。
- 已尝试的修复。
- 是否需要总指挥决策。

## 7. 阻塞回传格式

如果 Claude Code 无法继续，不要猜测。按这个格式回传：

```text
BLOCKED

Phase:
阻塞点:
已确认事实:
尝试过的方案:
需要总指挥决定的问题:
推荐选项:
风险:
```

阻塞示例：

- 文档中两个接口定义冲突。
- 当前依赖版本和文档建议不兼容。
- 第三方服务凭证缺失。
- 验收标准不清楚。
- 数据模型无法支持页面需求。

## 8. 禁止跨阶段扩展

Claude Code 不得因为“顺手”做这些事：

- Phase 0 顺手实现登录。
- Phase 2 顺手做支付。
- Phase 3 顺手写爬虫。
- Phase 5 顺手接真实微信授权。
- Phase 6 顺手重构全站 UI。
- Phase 7 顺手做自动提现。

如果发现下一阶段依赖当前阶段缺口，只能记录为“下一步建议”。

## 9. 质量门槛

每个阶段至少满足：

- TypeScript 类型通过。
- lint 通过。
- 单元测试或替代测试通过。
- 核心页面可访问。
- 关键接口有错误态处理。
- 高价值能力有权限和配额检查。
- 文档要求的 mock adapter 不伪装成真实外部服务。

## 10. 总指挥验收口径

总指挥会基于以下内容判断是否通过：

- 是否只做了指定 Phase。
- 是否遵守 PRD 和接口契约。
- 是否跑了验收命令。
- 是否存在未说明的风险。
- 是否引入了供应商锁定、爬虫风险、支付风险或公众号授权风险。
- 是否保持可替换 adapter 架构。

不通过时，Claude Code 会收到返工任务，而不是进入下一 Phase。

## 11. 给 Claude Code 的固定开场提示

每次启动 Claude Code 可以先粘贴：

```text
你是本项目的 Claude Code 执行者，底层模型为 DeepSeek V4 Pro。

请先阅读 CLAUDE.md、docs/README.md、docs/10-claude-code-command-center.md。

你必须按“一阶段一指令”模式工作。本次只执行我随后指定的 Phase。

注意：DeepSeek V4 Pro 是你的开发模型，不代表产品后端 AI Provider 必须使用 DeepSeek。产品 AI 功能必须按 AIProvider 抽象实现。

读完后只回复你已理解的执行纪律和等待 Phase 指令，不要开始写代码。
```

