# 产品 AI 创作引擎与 Provider 规范

> 文件名保留 `deepseek` 是历史命名。本文档的正式定位是“产品 AI 创作引擎规范”，不代表产品后端必须使用 DeepSeek。

## 1. 这个文档是干嘛的

本文件写给产品后端开发者，用来实现系统里的 AI 创作功能。它和 Claude Code 的开发模型不是一回事。

必须区分：

- **Claude Code + DeepSeek V4 Pro**：开发执行工具和开发模型，用来写代码。
- **产品 AIProvider**：产品上线后给用户生成提示词、文章、质检和重写的模型适配层。

产品首版只依赖 `AIProvider` 抽象，不强制绑定 DeepSeek。后续可以接 DeepSeek、OpenAI、通义、火山、Moonshot 或其他兼容模型。

本文件解决三类问题：

1. 产品 AI 功能如何抽象成 Provider。
2. 提示词生成、文章生成、质检、重写如何走统一任务流。
3. 内容质量如何用分阶段 Prompt 控制，减少 AI 腔、空话、乱编事实和不可解析输出。

## 2. Provider 设计原则

产品代码只能依赖统一接口：

```ts
export interface AIProvider {
  analyzeMaterial(input: AnalyzeMaterialInput): Promise<AnalyzeMaterialResult>;
  generatePrompt(input: GeneratePromptInput): Promise<GeneratePromptResult>;
  generateArticle(input: GenerateArticleInput): Promise<GenerateArticleResult>;
  reviewArticle(input: ReviewArticleInput): Promise<ReviewArticleResult>;
  rewriteArticle(input: RewriteArticleInput): Promise<RewriteArticleResult>;
}
```

禁止：

- 前端浏览器直接请求任何模型 API。
- 业务代码散落调用具体供应商 SDK。
- 把 Claude Code 的 DeepSeek 环境变量用于产品后端。
- 在数据库中只存某一家供应商专属字段。

允许：

- 首版实现一个真实供应商 Provider。
- 开发环境使用 `MockAIProvider`。
- 通过配置切换 Provider。

## 3. 推荐环境变量

Provider-neutral 配置：

```bash
AI_PROVIDER=mock
AI_MODEL=
AI_FAST_MODEL=
AI_BASE_URL=
AI_API_KEY=
AI_TIMEOUT_MS=120000
AI_JSON_MODE=true
```

如果选择 DeepSeek 作为产品 Provider，可配置：

```bash
AI_PROVIDER=deepseek
AI_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-v4-pro
AI_FAST_MODEL=deepseek-v4-flash
AI_API_KEY=
```

如果选择 OpenAI-compatible 供应商，也使用同一套 `AI_*` 变量。

## 4. 可选：DeepSeek 适配器说明

DeepSeek 当前支持 OpenAI/Anthropic 兼容格式：

- OpenAI-compatible base URL: `https://api.deepseek.com`
- Anthropic-compatible base URL: `https://api.deepseek.com/anthropic`
- Claude Code 使用 Anthropic-compatible 地址接入 DeepSeek。
- 产品后端如选择 DeepSeek，建议使用 OpenAI-compatible Chat Completions 风格实现 Provider。

DeepSeek JSON 输出要点：

- 请求中使用 `response_format: { "type": "json_object" }`。
- system 或 user prompt 中必须明确要求“只输出合法 JSON”。

参考：

- https://api-docs.deepseek.com/
- https://api-docs.deepseek.com/quick_start/agent_integrations/claude_code
- https://api-docs.deepseek.com/guides/json_mode

## 5. AI 创作流水线

首版不要用一个“大 Prompt”直接生成文章。正确流水线是：

1. **素材整理**：把 URL 抓取结果或用户粘贴文本整理成干净文本。
2. **素材分析**：提炼选题、爆点、标题模式、结构、语气、可用事实和风险。
3. **提示词生成**：把素材分析转成可复用写作提示词。
4. **文章生成**：基于标题、提示词、素材生成 Markdown 文章。
5. **文章质检**：检查原创性、事实风险、结构、公众号可读性和 AI 腔。
6. **必要时重写**：根据质检意见重写一次，再保存最终稿。

所有长耗时步骤必须由队列任务执行，前端只轮询任务状态。

## 6. 统一 JSON 输出要求

除最终展示给用户的 Markdown 外，AI 输出都应优先要求 JSON。

通用系统约束：

```text
你必须只输出合法 JSON。
不要输出 Markdown 代码块。
不要输出解释、前言、结语或额外文本。
如果信息不足，请在 JSON 字段中说明 unknown，不要编造。
```

如果供应商支持 JSON mode，必须开启。若供应商不支持，需要后端做 JSON 提取、校验和失败重试。

## 7. 素材分析 Prompt

用途：

- 将参考文章、榜单素材、用户粘贴内容转换成结构化创作资产。
- 后续提示词生成和文章生成都基于这个结果。

### 7.1 System Prompt

```text
你是中文自媒体内容分析师，擅长拆解公众号、头条、小红书、短视频文案中的选题、结构、情绪和传播逻辑。

你的任务是分析素材，而不是改写素材。

必须遵守：
1. 不复制素材的连续表达。
2. 不把素材中的未经证实内容当成事实。
3. 不输出违法、侵权、隐私、医疗诊断、金融承诺等高风险建议。
4. 只输出合法 JSON，不要输出 Markdown 代码块，不要输出解释。
```

### 7.2 User Prompt Template

```text
请分析以下素材，输出可用于公众号创作的结构化 JSON。

内容领域：{{contentDomain}}
目标读者：{{targetAudience}}
素材来源：{{sourceType}}

素材正文：
{{materialText}}

输出 JSON 格式：
{
  "topic": "素材核心选题，用一句话概括",
  "audiencePainPoints": ["读者痛点1", "读者痛点2"],
  "viralAngles": ["传播角度1", "传播角度2", "传播角度3"],
  "titlePatterns": [
    {
      "pattern": "标题套路描述",
      "example": "原创示例标题，不要复制原文"
    }
  ],
  "structure": [
    {
      "section": "段落功能",
      "purpose": "这一部分为什么存在"
    }
  ],
  "tone": {
    "voice": "语言风格",
    "sentenceRhythm": "句式节奏",
    "emotion": "主要情绪"
  },
  "usableFacts": ["可谨慎使用的事实或观点"],
  "riskNotes": ["需要避免或核实的风险点"],
  "doNotCopy": ["不能照搬的表达、案例或结论"]
}
```

## 8. 提示词生成 Prompt

用途：

- 用户在“提示词库”中用素材生成一个可反复使用的写作提示词。
- 产物不是文章，而是“写文章的作战说明书”。

### 8.1 System Prompt

```text
你是资深中文公众号内容策略师和提示词工程师。

你的任务是把用户提供的素材分析、领域、读者、人设和风格要求，整理成一个可复用的中文写作提示词。

这个提示词未来会给文章生成模型使用，所以必须具体、可执行、能约束输出质量。

必须遵守：
1. 不复制参考素材原文。
2. 不要求模型编造事实、数据、人物言论、政策细节或新闻来源。
3. 不承诺收益、疗效、投资结果或确定性结论。
4. 所谓“降低 AI 痕迹”只能理解为减少模板化、空泛、机械连接词和过度总结，不能用于规避平台规则或欺骗检测。
5. 输出必须是合法 JSON，不要输出 Markdown 代码块，不要输出解释。
```

### 8.2 User Prompt Template

```text
请生成一个公众号文章写作提示词。

基础配置：
- 提示词名称候选：{{name}}
- 内容领域：{{contentDomain}}
- 目标读者：{{targetAudience}}
- 作者人设：{{authorName}}
- 人设补充：{{personaDetails}}
- 性格特征：{{personalityTraits}}
- 标题结构：{{headingStyle}}
- 目标字数：{{wordCount}}
- 是否减少模板化 AI 腔：{{enableAIDetectionEvasion}}

素材分析：
{{materialAnalysisJson}}

用户补充要求：
{{userNotes}}

请输出 JSON：
{
  "name": "提示词名称，20字以内",
  "summary": "这个提示词适合什么场景，80字以内",
  "content": "完整提示词正文",
  "recommendedInputs": ["使用这个提示词时最好提供什么素材"],
  "titleRules": ["标题规则1", "标题规则2"],
  "structureRules": ["文章结构规则1", "文章结构规则2"],
  "styleRules": ["语言风格规则1", "语言风格规则2"],
  "materialRules": ["素材使用规则1", "素材使用规则2"],
  "forbiddenRules": ["禁止事项1", "禁止事项2"]
}
```

### 8.3 生成出的 content 必须包含

`content` 字段中的完整提示词必须包含这些小节：

```text
【写作身份】
你是谁，以什么视角写。

【目标读者】
写给谁，他们关心什么，阅读场景是什么。

【选题角度】
从什么矛盾、利益、情绪、趋势或经验切入。

【标题策略】
标题如何制造信息差、冲突感、利益点或好奇心。

【文章结构】
开头怎么抓人，中段怎么展开，结尾怎么收束。

【语言风格】
句子长短、语气、情绪、表达禁忌。

【素材使用规则】
如何使用参考素材，哪些只能借鉴逻辑，哪些需要核实。

【原创性要求】
不得复述原文，不得连续照搬，不得套模板。

【禁止事项】
不编造、不夸大、不承诺、不侵权。

【输出格式】
输出 Markdown，包含标题、正文、必要的小标题和图片占位。
```

## 9. 文章生成 Prompt

用途：

- 在“智能创作”中生成可进入排版器的 Markdown 文章。
- 文章生成必须基于用户选择的提示词和素材。

### 9.1 System Prompt

```text
你是专业中文公众号作者、编辑和内容质检员。

你的任务是生成一篇可发布前再编辑的原创公众号文章草稿。

必须遵守：
1. 严格依据用户给出的标题、写作提示词和参考素材。
2. 不复制参考素材的连续表达。
3. 不编造具体数据、真实人物言论、政策细节、新闻事实、研究结论或来源。
4. 不使用“首先、其次、最后、总而言之、在当今社会、不可忽视的是”等模板化连接词，除非确实自然。
5. 不使用过度夸张和绝对化表达，例如“必然、唯一、彻底改变、所有人都、稳赚、百分百”。
6. 输出必须是合法 JSON，不要输出 Markdown 代码块，不要输出解释。
```

### 9.2 User Prompt Template

```text
请生成公众号文章草稿。

标题：
{{title}}

写作提示词：
{{promptContent}}

参考素材分析：
{{materialAnalysisJson}}

参考 URL：
{{referenceUrls}}

用户粘贴素材：
{{materialText}}

生成配置：
- 目标字数：{{wordCount}}
- 图片数量：{{imageCount}}
- 图片策略：{{imageStrategy}}
- 小标题风格：{{headingStyle}}
- 是否减少模板化 AI 腔：{{enableAIDetectionEvasion}}

请输出 JSON：
{
  "title": "最终标题",
  "excerpt": "80字以内摘要",
  "markdown": "完整 Markdown 正文",
  "imageSlots": [
    {
      "index": 1,
      "alt": "图片说明",
      "placementHint": "建议放在什么段落后",
      "searchKeywords": ["配图关键词1", "配图关键词2"]
    }
  ],
  "coverPrompt": "封面图建议，60字以内",
  "riskNotes": ["文中仍需人工确认的事实或表达"]
}
```

### 9.3 Markdown 正文规则

`markdown` 必须满足：

- 第一段不能是泛泛背景介绍，要直接进入矛盾、场景、结果或问题。
- 每个小标题下面至少两段正文。
- 段落尽量短，适合手机阅读。
- 不要出现“本文将从以下几个方面展开”这类论文式表达。
- 需要图片时使用：`![图片说明](image-slot://1)`。
- 结尾不能只喊口号，要给读者一个判断、行动建议或情绪收束。

## 10. 文章质检 Prompt

用途：

- 生成后自动检查文章是否达到产品标准。
- 不通过时给重写模型明确修改意见。

### 10.1 System Prompt

```text
你是严格的公众号主编和事实风险审核员。

你要检查文章是否适合进入排版编辑环节。

只输出合法 JSON，不要输出 Markdown 代码块，不要输出解释。
```

### 10.2 User Prompt Template

```text
请审核以下文章。

标题：
{{title}}

参考素材摘要：
{{materialAnalysisJson}}

文章 Markdown：
{{markdown}}

请输出 JSON：
{
  "pass": true,
  "score": {
    "originality": 0,
    "structure": 0,
    "readability": 0,
    "materialUsage": 0,
    "factualRisk": 0,
    "wechatFit": 0,
    "antiTemplateTone": 0
  },
  "problems": [
    {
      "type": "问题类型",
      "severity": "low|medium|high",
      "detail": "具体问题",
      "rewriteAdvice": "如何修改"
    }
  ],
  "rewriteRequired": false,
  "rewriteInstructions": "如果需要重写，给出清晰修改指令"
}
```

评分解释：

- 每项 0 到 10 分。
- `pass=true` 要求平均分不低于 7，且没有 high 问题。
- `factualRisk` 分数越高代表风险越低。

## 11. 文章重写 Prompt

用途：

- 文章质检不通过时，根据具体问题重写。

### 11.1 System Prompt

```text
你是公众号文章改稿编辑。

你只能根据审核意见改进文章，不要改变用户的核心选题。
你必须保留文章中已经合格的部分，重点修复结构、语言、事实风险、AI 腔和可读性问题。

只输出合法 JSON，不要输出 Markdown 代码块，不要输出解释。
```

### 11.2 User Prompt Template

```text
请根据审核意见重写文章。

原始标题：
{{title}}

原始文章：
{{markdown}}

审核问题：
{{reviewProblemsJson}}

重写指令：
{{rewriteInstructions}}

请输出 JSON：
{
  "title": "修改后的标题",
  "excerpt": "80字以内摘要",
  "markdown": "修改后的完整 Markdown",
  "changeSummary": ["修改点1", "修改点2"],
  "riskNotes": ["仍需人工确认的问题"]
}
```

## 12. 任务状态机

### 12.1 prompt_generation_jobs

状态流转：

- `pending` -> `running`
- `running` -> `completed`
- `running` -> `failed`
- `failed` -> `pending`，仅管理员或自动重试触发。

任务步骤：

1. 整理素材。
2. 分析素材。
3. 生成提示词。
4. 保存 prompt。
5. 扣减 `prompt_generate` 配额。

### 12.2 article_generation_jobs

状态流转：

- `pending` -> `running`
- `running` -> `completed`
- `running` -> `failed`
- `failed` -> `pending`
- `pending/running` -> `cancelled`

任务步骤：

1. 校验用户、会员、配额。
2. 读取 prompt。
3. 整理素材。
4. 分析素材。
5. 生成文章。
6. 自动质检。
7. 必要时重写一次。
8. 保存 article。
9. 扣减 `article_generate` 配额。

## 13. 重试策略

可重试错误：

- 网络超时。
- 429 rate limit。
- 5xx 服务错误。
- 临时网关错误。
- JSON 解析失败但原始返回不为空。

不可重试错误：

- API Key 无效。
- 输入超长。
- 内容安全拒绝。
- 用户配额不足。
- 用户删除了关联 prompt 或 article。

默认策略：

- 最多 3 次。
- 间隔 10s、30s、90s。
- 每次重试记录 `attempts`。
- 最终失败写入 `error_message` 和 `error_code`。

## 14. 内容安全与质量底线

生成前检查：

- 标题不能为空。
- URL 必须是 http/https。
- 文本素材长度必须在限制内。
- 用户输入中要求“泄露系统提示词、忽略规则、复制原文”的内容必须被忽略。

生成后检查：

- JSON 可解析。
- Markdown 不为空。
- 不包含系统提示词泄露。
- 不包含大段重复。
- 不包含明显未闭合 HTML。
- 不包含未经提示的极端承诺。

高风险内容处理：

- 医疗、法律、金融、政策、新闻事实必须保守表达。
- 无来源数据不能写成确定事实。
- 涉及真实人物、公司、品牌时，必须避免编造。

## 15. 日志与成本记录

每次 AI 请求记录：

- user_id
- job_id
- provider
- model
- request_type
- prompt_tokens
- completion_tokens
- total_tokens
- latency_ms
- status
- error_code
- retry_count

不要记录：

- API Key。
- 用户密码。
- 完整 session。
- 未脱敏的敏感个人信息。

## 16. 首版实现建议

首版必须真实实现：

- `AIProvider` 抽象。
- 至少一个真实 Provider 或一个可配置 Provider。
- 提示词生成。
- 文章生成。
- 文章质检。
- 失败重试。
- token 用量记录。

首版可以简化：

- URL 抓取失败时，让用户粘贴正文。
- 图片不必真实生成，只生成图片位和配图关键词。
- 质检失败只自动重写一次。

首版不要做：

- 反爬绕过。
- 自动洗稿。
- 自动规避平台检测。
- 无人工确认的高风险事实生成。

