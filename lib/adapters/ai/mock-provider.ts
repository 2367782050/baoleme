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
  GenerateTrackPromptInput,
  GenerateTrackPromptResult,
  TokenUsage,
} from "./types";

export class MockAIProvider implements AIProvider {
  private failNext = false;
  private _forceRewrite = false;

  /** Call this to make the next generatePrompt call fail */
  setFailNext(fail: boolean) {
    this.failNext = fail;
  }

  /** Force reviewArticle to require a rewrite */
  setForceRewrite(rewrite: boolean) {
    this._forceRewrite = rewrite;
  }

  async generatePrompt(
    input: GeneratePromptInput,
  ): Promise<{ result: GeneratePromptResult; usage: TokenUsage }> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("Mock AI failure: 模拟 AI 调用失败");
    }

    // Simulate AI latency
    await new Promise((r) => setTimeout(r, 10));

    const content = this.buildContent(input);
    const name = input.name.length <= 20 ? input.name : input.name.substring(0, 20);

    return {
      result: {
        name,
        summary: `适用于${input.contentDomain}领域的写作提示词，面向${input.targetAudience}，以${input.authorName}的视角输出。`,
        content,
        recommendedInputs: [
          "对标账号的3-5篇爆款文章链接",
          "该领域近期的热搜标题",
          "目标读者画像和阅读场景描述",
        ],
        titleRules: [
          `标题使用${input.headingStyle}结构`,
          "标题包含数字、对比或疑问元素",
          "标题不超过30字",
        ],
        structureRules: [
          "开头直入矛盾或场景，不超过3句话",
          "中段用2-3个子标题展开，每段不超过5行",
          "结尾给出具体行动建议或判断",
        ],
        styleRules: [
          `以${input.personalityTraits.join("、")}的语气写作`,
          "句子以短句为主，段落不超过4行",
          input.enableAIDetectionEvasion ? "减少模板化表达，避免过度总结" : "保持自然流畅",
        ],
        materialRules: [
          "参考素材只借鉴逻辑和结构，不照搬原文",
          "数据和事实需要核实后再使用",
        ],
        forbiddenRules: [
          "不编造具体数据、人物言论、政策细节",
          "不承诺收益、疗效、投资结果",
          "不套用模板连接词",
        ],
      },
      usage: {
        promptTokens: 1200,
        completionTokens: 800,
        totalTokens: 2000,
      },
    };
  }

  async analyzeMaterial(
    input: AnalyzeMaterialInput,
  ): Promise<{ result: AnalyzeMaterialResult; usage: TokenUsage }> {
    await new Promise((r) => setTimeout(r, 5));
    return {
      result: {
        topic: `${input.contentDomain}领域趋势分析与读者兴趣洞察`,
        audiencePainPoints: ["信息过载，难以筛选高质量内容", "缺乏系统性的行业认知框架"],
        viralAngles: ["数据对比制造冲突感", "从具体案例切入引发共鸣", "提供可操作的检查清单"],
        titlePatterns: [
          { pattern: "数字型", example: `${input.contentDomain}从业者必知的5个趋势` },
          { pattern: "疑问型", example: `为什么你的${input.contentDomain}策略总是失效？` },
        ],
        structure: [
          { section: "引言", purpose: "用数据或场景制造紧迫感" },
          { section: "主体", purpose: "分点阐述核心观点，每点配案例" },
          { section: "总结", purpose: "给出可执行的下一步建议" },
        ],
        tone: { voice: "理性而不失温度", sentenceRhythm: "短句为主，节奏明快", emotion: "关切" },
        usableFacts: ["行业公开数据可作为引用基础", "读者留言反馈可作为选题参考"],
        riskNotes: ["避免使用未经核实的具体数字", "注意不侵犯第三方版权"],
        doNotCopy: ["不要照搬原文的连续段落", "不要复制独创性表达"],
      },
      usage: { promptTokens: 600, completionTokens: 400, totalTokens: 1000 },
    };
  }

  async generateArticle(
    input: GenerateArticleInput,
  ): Promise<{ result: GenerateArticleResult; usage: TokenUsage }> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("Mock AI failure: 模拟文章生成失败");
    }
    await new Promise((r) => setTimeout(r, 10));

    const markdown = this.buildArticleMarkdown(input);

    return {
      result: {
        title: input.title || "未命名文章",
        excerpt: `本文围绕${input.title}展开讨论，提供深度分析与实操建议。`,
        markdown,
        imageSlots: Array.from({ length: input.imageCount }, (_, i) => ({
          index: i + 1,
          alt: `配图${i + 1}`,
          placementHint: `建议放在第${i + 1}个小标题下方`,
          searchKeywords: ["数据图表", "示意图"],
        })),
        coverPrompt: `简洁大气的封面，突出"${input.title.substring(0, 10)}"主题`,
        riskNotes: ["部分数据建议发布前核实"],
      },
      usage: { promptTokens: 2000, completionTokens: 3000, totalTokens: 5000 },
    };
  }

  async reviewArticle(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _input: ReviewArticleInput,
  ): Promise<{ result: ReviewArticleResult; usage: TokenUsage }> {
    await new Promise((r) => setTimeout(r, 5));

    if (this._forceRewrite) {
      this._forceRewrite = false;
      return {
        result: {
          pass: false,
          score: { originality: 6, structure: 5, readability: 6, materialUsage: 5, factualRisk: 4, wechatFit: 5, antiTemplateTone: 4 },
          problems: [
            { type: "structure", severity: "medium", detail: "文章结构过于松散", rewriteAdvice: "增加小标题层级，每部分2段正文" },
          ],
          rewriteRequired: true,
          rewriteInstructions: "重构文章结构，增加小标题层级，每部分写2段正文。开头要更直接，去掉泛泛的背景介绍。",
        },
        usage: { promptTokens: 500, completionTokens: 300, totalTokens: 800 },
      };
    }

    return {
      result: {
        pass: true,
        score: { originality: 8, structure: 8, readability: 9, materialUsage: 7, factualRisk: 7, wechatFit: 8, antiTemplateTone: 8 },
        problems: [],
        rewriteRequired: false,
        rewriteInstructions: "",
      },
      usage: { promptTokens: 500, completionTokens: 200, totalTokens: 700 },
    };
  }

  async rewriteArticle(
    input: RewriteArticleInput,
  ): Promise<{ result: RewriteArticleResult; usage: TokenUsage }> {
    await new Promise((r) => setTimeout(r, 10));

    return {
      result: {
        title: input.title,
        excerpt: "改写后的文章，结构更加清晰。",
        markdown: input.markdown.replace("## ", "## 【精修】"),
        changeSummary: ["重构了文章结构", "优化了段落过渡"],
        riskNotes: [],
      },
      usage: { promptTokens: 1000, completionTokens: 1500, totalTokens: 2500 },
    };
  }

  private buildContent(input: GeneratePromptInput): string {
    const antiAI = input.enableAIDetectionEvasion
      ? "\n【降低AI痕迹】减少模板化表达、机械连接词和过度总结，保持口语化但不随意。"
      : "";

    return `【写作身份】
你是一位专注于${input.contentDomain}领域的自媒体作者，笔名"${input.authorName}"。${input.personaDetails}

【目标读者】
面向${input.targetAudience}，他们关心行业趋势、实操方法和个人成长。阅读场景以移动端碎片化阅读为主。

【选题角度】
从行业矛盾、读者利益和趋势变化切入，用信息差和冲突感制造阅读动力。

【标题策略】
- 标题使用${input.headingStyle}结构
- 制造信息差、利益点或好奇心
- 控制在30字以内

【文章结构】
1. 开头：用具体场景或数据开场，3句话内抓住读者
2. 中段：2-3个子标题，每部分先给观点再给例子
3. 结尾：给出可操作的判断或行动建议，不喊口号

【语言风格】
- 性格特征：${input.personalityTraits.join("、")}
- 句式：短句为主，段落不超过4行
- 语气：说人话，不装腔作势${antiAI}

【素材使用规则】
- 参考素材仅用于理解选题和结构，不照搬原文
- 数据必须核实，不确定的标注"建议核实"
- 案例用概括而非逐句复制

【原创性要求】
- 不得复述参考素材的连续表达
- 结构借鉴但语言完全重写
- 观点和判断必须是原创

【禁止事项】
- 不编造具体数据、人物言论、政策细节或新闻来源
- 不承诺收益、疗效、投资结果或确定性结论
- 不使用"首先其次最后总而言之在当今社会不可忽视的是"等模板化表达

【输出格式】
输出 Markdown，目标字数 ${input.wordCount} 字左右。包含标题、正文、小标题和必要的图片占位标记。`;
  }

  private buildArticleMarkdown(input: GenerateArticleInput): string {
    const antiAI = input.enableAIDetectionEvasion ? " 口语化表达，避免模板句式。" : "";
    return `# ${input.title}

开头段落：在当今信息爆炸的时代，${input.title}的话题越来越受到关注。${antiAI}

## 核心观点一

本部分围绕关键问题展开讨论，从多个角度分析现状和趋势。

面对当前的挑战，我们需要重新审视传统的思维模式，寻找更具创新性的解决方案。

## 核心观点二

实际案例表明，掌握正确的方法论至关重要。以下是几个值得关注的方向：

1. 数据驱动的决策
2. 用户视角的思考
3. 持续迭代的优化

## 行动建议

基于以上分析，建议读者从以下三个方面入手：

- 首先，建立系统化的认知框架
- 其次，积累实践经验
- 最后，不断优化和迭代

${input.imageCount > 0 ? input.imageCount > 0 ? Array.from({ length: input.imageCount }, (_, i) => `![配图${i + 1}](image-slot://${i + 1})`).join("\n\n") : "" : ""}

> 本文内容仅供参考，具体决策请结合实际情况。`;
  }

  async generateTrackPrompt(input: GenerateTrackPromptInput): Promise<{ result: GenerateTrackPromptResult; usage: TokenUsage }> {
    if (this.failNext) { this.failNext = false; throw new Error("Mock AI failure: track prompt generation"); }
    const articleAnalyses = input.articles.map((a) => ({
      articleId: a.id, title: a.title,
      analysis: {
        titlePatterns: ["数字型标题", "疑问句式"],
        openingHooks: ["数据开场", "悬念设问"],
        emotionalTriggers: ["焦虑感", "获得感"],
        structurePatterns: ["总-分-总", "并列列举"],
        materialUsage: ["引用研究数据", "案例对比"],
        goldenSentences: ["金句示例1", "金句示例2"],
        riskNotes: ["避免过度承诺", "数据需核实"],
        doNotCopy: ["不可直接复制原文结构"],
      },
    }));
    const result: GenerateTrackPromptResult = {
      name: input.name,
      summary: `基于${input.articles.length}篇${input.domainName}爆款文章的赛道统一提示词`,
      content: `【赛道提示词】\n领域：${input.domainName}\n目标读者：${input.targetAudience}\n作者人设：${input.authorPersona}\n\n## 标题规则\n- 数字型标题优先\n- 使用疑问句式\n\n## 结构\n- 总-分-总布局\n\n## 风格\n- 数据驱动\n- 理性克制\n\n## 素材使用\n- 引用权威数据\n- 案例对比\n\n## 禁止\n- 不保证收益\n- 不制造焦虑`,
      articleAnalyses,
      trackInsights: {
        commonTitlePatterns: ["数字型", "疑问句"],
        commonOpenings: ["数据", "悬念"],
        commonStructures: ["总-分-总"],
        commonEmotions: ["焦虑", "获得"],
        readerPainPoints: ["信息不对称", "决策困难"],
        reusableAngles: ["趋势分析", "案例拆解"],
        forbiddenRules: ["不保证收益", "不制造恐慌"],
      },
      recommendedInputs: ["行业数据", "案例链接"],
      titleRules: ["数字型优先", "不超过25字"],
      structureRules: ["开头引共鸣", "中间给干货", "结尾促行动"],
      styleRules: ["口语化", "数据引用"],
      materialRules: ["引用标注来源", "案例脱敏"],
      forbiddenRules: ["不保证收益", "不承诺确定性"],
    };
    return { result, usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 } };
  }
}

export const mockAIProvider = new MockAIProvider();
