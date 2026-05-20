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

  private aiError(message: string, cause?: unknown): Error {
    const err = new Error(message);
    (err as unknown as Record<string, unknown>).cause = cause;
    (err as unknown as Record<string, unknown>).code = "AI_PROVIDER_ERROR";
    return err;
  }

  private async handleResponse(res: Response): Promise<Record<string, unknown>> {
    const text = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) {
      throw this.aiError("AI 认证失败，请检查 API Key 和权限");
    }
    if (res.status >= 500) {
      throw this.aiError("AI 服务暂时不可用，请稍后重试");
    }
    throw this.aiError(`AI 请求失败 (${res.status}): ${text.substring(0, 300)}`);
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
    const typeLabels: Record<string, string> = {
      analyzeMaterial: "分析素材并提取可用的选题角度和结构建议",
      generateArticle: "生成一篇完整的公众号文章（title, excerpt, markdown 三字段都必须有中文内容）",
      reviewArticle: "审核文章质量并给出评分和改进建议",
      rewriteArticle: "根据审核意见重写文章",
    };
    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: `你是专业的中文自媒体内容创作者。任务：${typeLabels[type] ?? type}。请输出合法 JSON，所有文本字段必须使用中文。直接输出纯 JSON 对象，开头就是 {，不要加任何解释或 Markdown 代码块。` },
            { role: "user", content: `任务类型：${type}\n输入数据：${JSON.stringify(input)}` },
          ],
          temperature: 0.7,
          max_tokens: 4096,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw await this.handleResponse(res);
      }
      const body = await res.json();
      let raw = (body.choices?.[0]?.message?.content ?? "").trim();
      if (!raw) throw this.aiError("AI 未返回有效结果，请重试");

      // Extract JSON from Markdown code blocks if present (DeepSeek habit)
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) raw = jsonMatch[0];

      let parsed: T;
      try { parsed = JSON.parse(raw) as T; } catch { throw this.aiError("AI 返回格式异常，请重试"); }
      return {
        result: parsed,
        usage: {
          promptTokens: body.usage?.prompt_tokens ?? 0,
          completionTokens: body.usage?.completion_tokens ?? 0,
          totalTokens: body.usage?.total_tokens ?? 0,
        },
      };
    } catch (e) {
      if (e instanceof Error && (e as unknown as Record<string,unknown>).code === "AI_PROVIDER_ERROR") throw e;
      if ((e as Error).name === "AbortError") {
        throw this.aiError(`AI 调用超时（${this.timeoutMs}ms），请检查网络或增加超时时间`);
      }
      throw this.aiError("AI 调用失败，请检查网络连接和 API 配置", e);
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
          temperature: 0.7,
          max_tokens: 4096,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw await this.handleResponse(res);
      }

      const body = await res.json();
      let raw = (body.choices?.[0]?.message?.content ?? "").trim();
      if (!raw) throw this.aiError("AI 未返回有效结果，请重试");
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) raw = jsonMatch[0];
      let result: GeneratePromptResult;
      try { result = JSON.parse(raw) as GeneratePromptResult; } catch { throw this.aiError("AI 返回格式异常，请重试"); }

      return {
        result,
        usage: {
          promptTokens: body.usage?.prompt_tokens ?? 0,
          completionTokens: body.usage?.completion_tokens ?? 0,
          totalTokens: body.usage?.total_tokens ?? 0,
        },
      };
    } catch (e) {
      if (e instanceof Error && (e as unknown as Record<string,unknown>).code === "AI_PROVIDER_ERROR") throw e;
      if ((e as Error).name === "AbortError") {
        throw this.aiError(`AI 调用超时（${this.timeoutMs}ms），请检查网络或增加超时时间`);
      }
      throw this.aiError("AI 调用失败，请检查网络连接和 API 配置", e);
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
