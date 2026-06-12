import type {
  AIProvider,
  GeneratePromptInput,
  GeneratePromptResult,
  AnalyzeMaterialInput,
  AnalyzeMaterialResult,
  GenerateArticleInput,
  GenerateArticleResult,
  ArticleWritingMode,
  HumanizationReport,
  ReviewArticleInput,
  ReviewArticleResult,
  RewriteArticleInput,
  RewriteArticleResult,
  GenerateTrackPromptInput,
  GenerateTrackPromptResult,
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
    const writingMode = input.writingMode ?? "quick";
    const stageInput = { ...input, writingMode };
    if (writingMode === "quick") {
      return this.chatJson<GenerateArticleResult>(stageInput, "generateArticle");
    }

    const strategy = await this.chatJson<{
      titleAngle: string;
      openingHook: string;
      outline: string[];
      emotionPath: string[];
      materialUsage: string[];
      doNotCopy: string[];
      humanToneRules: string[];
    }>(stageInput, "buildArticleStrategy");

    const draft = await this.chatJson<GenerateArticleResult>({
      ...stageInput,
      strategy: strategy.result,
    }, "generateArticleDraft");

    const humanized = await this.chatJson<GenerateArticleResult>({
      ...stageInput,
      strategy: strategy.result,
      draftMarkdown: draft.result.markdown,
    }, "humanizeArticleDraft");

    const quality = await this.chatJson<GenerateArticleResult>({
      ...stageInput,
      strategy: strategy.result,
      draftMarkdown: draft.result.markdown,
      humanizedMarkdown: humanized.result.markdown,
    }, "reviewHumanization");

    const humanizationReport = quality.result.humanizationReport
      ?? humanized.result.humanizationReport
      ?? this.buildFallbackHumanizationReport(writingMode, strategy.result.outline, quality.result.riskNotes);

    return {
      result: {
        ...quality.result,
        outline: quality.result.outline ?? humanized.result.outline ?? strategy.result.outline,
        draftMarkdown: draft.result.markdown,
        humanizationReport,
        riskNotes: [
          ...(quality.result.riskNotes ?? humanized.result.riskNotes ?? []),
          "涉及真实数据、个人经历、第三方观点时，发布前仍需人工核实。",
        ],
      },
      usage: {
        promptTokens: strategy.usage.promptTokens + draft.usage.promptTokens + humanized.usage.promptTokens + quality.usage.promptTokens,
        completionTokens: strategy.usage.completionTokens + draft.usage.completionTokens + humanized.usage.completionTokens + quality.usage.completionTokens,
        totalTokens: strategy.usage.totalTokens + draft.usage.totalTokens + humanized.usage.totalTokens + quality.usage.totalTokens,
      },
    };
  }

  private buildFallbackHumanizationReport(
    writingMode: ArticleWritingMode,
    outline: string[] = [],
    riskNotes: string[] = [],
  ): HumanizationReport {
    return {
      writingMode,
      strategySummary: outline.length > 0 ? outline : ["已完成策略、初稿、人味改写和质检"],
      humanizationEdits: ["压缩模板化表达", "补充读者场景", "保留事实边界"],
      materialUsage: ["仅使用用户提供素材和素材分析结果"],
      originalityChecks: ["不照抄爆款连续表达", "不把他人经历写成自己的经历"],
      riskNotes,
      aiLikeRisk: "medium",
      genericPhrases: [],
      weakParagraphs: [],
      concreteDetailsCount: 0,
      rhythmIssues: [],
      rewriteNotes: [],
    };
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
      buildArticleStrategy: "根据选题、素材和赛道提示词生成写作策略，不写正文",
      generateArticleDraft: "根据写作策略生成初稿，必须有具体读者场景和观点边界",
      humanizeArticleDraft: "在不伪造经历和数据的前提下，对初稿做人味改写，删除空话和模板句",
      reviewHumanization: "质检终稿，检查自然度、素材真实性、原创性和事实风险，输出完整文章以及 humanizationReport",
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
            { role: "system", content: `你是专业的中文自媒体内容编辑。任务：${typeLabels[type] ?? type}。请输出合法 JSON，所有文本字段必须使用中文。直接输出纯 JSON 对象，开头就是 {，不要加任何解释或 Markdown 代码块。重要边界：不要承诺通过任何 AI 检测；不要伪造经历或数据、引用、机构或链接；不要照抄爆款或连续表达；参考素材只借鉴结构和选题；不确定事实必须写成需要人工核实。` },
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
- 是否减少模板化表达：${input.enableAIDetectionEvasion}

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

  async generateTrackPrompt(input: GenerateTrackPromptInput): Promise<{ result: GenerateTrackPromptResult; usage: TokenUsage }> {
    const systemPrompt = `你是资深中文公众号内容策略师和赛道拆解专家。
任务：分析 ${input.articles.length} 篇「${input.domainName}」赛道的爆款文章，提取共性规律，生成一个可复用的赛道级写作提示词。

流程：
1. 逐篇拆解每篇文章的标题、开头、情绪钩子、结构、素材用法、金句
2. 找出共性规律（标题模式、开头方式、结构、情绪、读者痛点）
3. 输出一个完整的赛道提示词（面向作者：${input.authorPersona}，面向读者：${input.targetAudience}）

必须遵守：
1. 所有分析基于原文，不编造
2. 通用规律要可操作，不要太抽象
3. 禁止规则要明确，可检查
4. 输出合法 JSON，开头直接 {，不要加解释或 Markdown 代码块`;

    const articlesJson = JSON.stringify(input.articles.map((a) => ({
      id: a.id, title: a.title, fullContent: a.fullContent.substring(0, 3000),
      readCount: a.readCount, likeCount: a.likeCount,
    })));

    const userPrompt = `分析以下 ${input.articles.length} 篇「${input.domainName}」赛道的爆款文章，生成赛道提示词。

文章列表：
${articlesJson}

提示词名称：${input.name}
目标读者：${input.targetAudience}
作者人设：${input.authorPersona}
${input.userNotes ? `用户补充：${input.userNotes}` : ""}

请输出 JSON（所有 text 字段必须使用中文）：
{
  "name": "提示词名称",
  "summary": "赛道提示词摘要，80字",
  "content": "完整提示词正文",
  "articleAnalyses": [{ "articleId": "...", "title": "...", "analysis": { "titlePatterns": [], "openingHooks": [], "emotionalTriggers": [], "structurePatterns": [], "materialUsage": [], "goldenSentences": [], "riskNotes": [], "doNotCopy": [] } }],
  "trackInsights": { "commonTitlePatterns": [], "commonOpenings": [], "commonStructures": [], "commonEmotions": [], "readerPainPoints": [], "reusableAngles": [], "forbiddenRules": [] },
  "recommendedInputs": [], "titleRules": [], "structureRules": [], "styleRules": [], "materialRules": [], "forbiddenRules": []
}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({ model: this.model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], temperature: 0.7, max_tokens: 8192 }),
        signal: controller.signal,
      });
      if (!res.ok) throw await this.handleResponse(res);
      const body = await res.json();
      let raw = (body.choices?.[0]?.message?.content ?? "").trim();
      if (!raw) throw this.aiError("AI 未返回有效结果，请重试");
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) raw = jsonMatch[0];
      let result: GenerateTrackPromptResult;
      try { result = JSON.parse(raw) as GenerateTrackPromptResult; } catch { throw this.aiError("AI 返回格式异常，请重试"); }
      return { result, usage: { promptTokens: body.usage?.prompt_tokens ?? 0, completionTokens: body.usage?.completion_tokens ?? 0, totalTokens: body.usage?.total_tokens ?? 0 } };
    } catch (e) {
      if (e instanceof Error && (e as unknown as Record<string,unknown>).code === "AI_PROVIDER_ERROR") throw e;
      if ((e as Error).name === "AbortError") throw this.aiError(`AI 调用超时（${this.timeoutMs}ms），请检查网络或增加超时时间`);
      throw this.aiError("AI 调用失败，请检查网络连接和 API 配置", e);
    } finally { clearTimeout(timer); }
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
