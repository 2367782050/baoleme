import type {
  AIProvider,
  GeneratePromptInput,
  GeneratePromptResult,
  AnalyzeMaterialInput,
  AnalyzeMaterialResult,
  GenerateArticleInput,
  GenerateArticleResult,
  ReviewArticleInput,
  ReviewArticleResult,
  RewriteArticleInput,
  RewriteArticleResult,
  TokenUsage,
} from "./types";

export class OpenAICompatibleProvider implements AIProvider {
  private baseUrl: string;
  private apiKey: string;
  private model: string;
  private timeoutMs: number;

  constructor(config: {
    baseUrl: string;
    apiKey: string;
    model: string;
    timeoutMs?: number;
  }) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.timeoutMs = config.timeoutMs ?? 120000;
  }

  async analyzeMaterial(input: AnalyzeMaterialInput): Promise<{ result: AnalyzeMaterialResult; usage: TokenUsage }> {
    return this.chatJson<AnalyzeMaterialResult>(input, "analyzeMaterial");
  }

  async generateArticle(input: GenerateArticleInput): Promise<{ result: GenerateArticleResult; usage: TokenUsage }> {
    return this.chatJson<GenerateArticleResult>(input, "generateArticle");
  }

  async reviewArticle(input: ReviewArticleInput): Promise<{ result: ReviewArticleResult; usage: TokenUsage }> {
    return this.chatJson<ReviewArticleResult>(input, "reviewArticle");
  }

  async rewriteArticle(input: RewriteArticleInput): Promise<{ result: RewriteArticleResult; usage: TokenUsage }> {
    return this.chatJson<RewriteArticleResult>(input, "rewriteArticle");
  }

  private async chatJson<T>(input: unknown, type: string): Promise<{ result: T; usage: TokenUsage }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: `You are a Chinese content creator. Task: ${type}. Output ONLY valid JSON, no markdown.` },
            { role: "user", content: JSON.stringify(input) },
          ],
          response_format: { type: "json_object" },
          temperature: 0.7,
          max_tokens: 4096,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`AI API error ${res.status}: ${text.substring(0, 200)}`);
      }
      const body = await res.json();
      const raw = body.choices?.[0]?.message?.content ?? "";
      return {
        result: JSON.parse(raw) as T,
        usage: {
          promptTokens: body.usage?.prompt_tokens ?? 0,
          completionTokens: body.usage?.completion_tokens ?? 0,
          totalTokens: body.usage?.total_tokens ?? 0,
        },
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async generatePrompt(
    input: GeneratePromptInput,
  ): Promise<{ result: GeneratePromptResult; usage: TokenUsage }> {
    const systemPrompt = `你是资深中文公众号内容策略师和提示词工程师。
你的任务是把用户提供的素材分析、领域、读者、人设和风格要求，整理成一个可复用的中文写作提示词。
这个提示词未来会给文章生成模型使用，所以必须具体、可执行、能约束输出质量。
必须遵守：
1. 不复制参考素材原文。
2. 不要求模型编造事实、数据、人物言论、政策细节或新闻来源。
3. 不承诺收益、疗效、投资结果或确定性结论。
4. 输出必须是合法 JSON，不要输出 Markdown 代码块，不要输出解释。`;

    const userPrompt = `请生成一个公众号文章写作提示词。

基础配置：
- 提示词名称候选：${input.name}
- 内容领域：${input.contentDomain}
- 目标读者：${input.targetAudience}
- 作者人设：${input.authorName}
- 人设补充：${input.personaDetails}
- 性格特征：${input.personalityTraits.join("、")}
- 标题结构：${input.headingStyle}
- 目标字数：${input.wordCount}
- 是否减少模板化 AI 腔：${input.enableAIDetectionEvasion}

素材分析：
${input.materialAnalysisJson}

用户补充要求：
${input.userNotes}

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
}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.7,
          max_tokens: 4096,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`AI API error ${res.status}: ${text.substring(0, 200)}`);
      }

      const body = await res.json();
      const raw = body.choices?.[0]?.message?.content ?? "";
      const result = JSON.parse(raw) as GeneratePromptResult;

      return {
        result,
        usage: {
          promptTokens: body.usage?.prompt_tokens ?? 0,
          completionTokens: body.usage?.completion_tokens ?? 0,
          totalTokens: body.usage?.total_tokens ?? 0,
        },
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

export async function createConfiguredProvider(): Promise<AIProvider> {
  const provider = (process.env.AI_PROVIDER ?? "mock").toLowerCase();

  if (provider === "mock" || !process.env.AI_API_KEY) {
    const { mockAIProvider } = await import("./mock-provider");
    return mockAIProvider;
  }

  return new OpenAICompatibleProvider({
    baseUrl: process.env.AI_BASE_URL ?? "https://api.openai.com/v1",
    apiKey: process.env.AI_API_KEY,
    model: process.env.AI_MODEL ?? "gpt-4o",
    timeoutMs: parseInt(process.env.AI_TIMEOUT_MS ?? "120000", 10),
  });
}
