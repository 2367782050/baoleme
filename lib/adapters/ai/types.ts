export type AnalyzeMaterialInput = {
  contentDomain: string;
  targetAudience: string;
  sourceType: string;
  materialText: string;
};

export type AnalyzeMaterialResult = {
  topic: string;
  audiencePainPoints: string[];
  viralAngles: string[];
  titlePatterns: { pattern: string; example: string }[];
  structure: { section: string; purpose: string }[];
  tone: { voice: string; sentenceRhythm: string; emotion: string };
  usableFacts: string[];
  riskNotes: string[];
  doNotCopy: string[];
};

export type GeneratePromptInput = {
  name: string;
  contentDomain: string;
  targetAudience: string;
  authorName: string;
  personaDetails: string;
  personalityTraits: string[];
  headingStyle: string;
  wordCount: number;
  enableAIDetectionEvasion: boolean;
  materialAnalysisJson: string;
  userNotes: string;
};

export type GeneratePromptResult = {
  name: string;
  summary: string;
  content: string;
  recommendedInputs: string[];
  titleRules: string[];
  structureRules: string[];
  styleRules: string[];
  materialRules: string[];
  forbiddenRules: string[];
};

export type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

// ─── Article generation types ─────────────────────────────────

export type GenerateArticleInput = {
  title: string;
  promptContent: string;
  materialAnalysisJson: string;
  referenceUrls: string[];
  materialText: string;
  writingMode?: ArticleWritingMode;
  targetAudience?: string;
  corePoint?: string;
  personalExperience?: string;
  forbiddenExpressions?: string;
  expectedTone?: string;
  contentDomain?: string;
  promptContextSummary?: unknown;
  wordCount: number;
  imageCount: number;
  imageStrategy: string;
  headingStyle: string;
  enableAIDetectionEvasion: boolean;
};

export type ArticleWritingMode = "quick" | "material_based" | "viral_deep" | "humanized";

export type HumanizationReport = {
  writingMode?: ArticleWritingMode;
  strategySummary?: string[];
  humanizationEdits?: string[];
  materialUsage?: string[];
  originalityChecks?: string[];
  riskNotes: string[];
  aiLikeRisk?: "low" | "medium" | "high";
  genericPhrases?: string[];
  weakParagraphs?: string[];
  concreteDetailsCount?: number;
  rhythmIssues?: string[];
  rewriteNotes?: string[];
};

export type GenerateArticleResult = {
  title: string;
  excerpt: string;
  markdown: string;
  outline?: string[];
  draftMarkdown?: string;
  humanizationReport?: HumanizationReport;
  imageSlots: { index: number; alt: string; placementHint: string; searchKeywords: string[] }[];
  coverPrompt: string;
  riskNotes: string[];
};

export type ReviewArticleInput = {
  title: string;
  materialAnalysisJson: string;
  markdown: string;
};

export type ReviewArticleResult = {
  pass: boolean;
  score: {
    originality: number;
    structure: number;
    readability: number;
    materialUsage: number;
    factualRisk: number;
    wechatFit: number;
    antiTemplateTone: number;
  };
  problems: { type: string; severity: "low" | "medium" | "high"; detail: string; rewriteAdvice: string }[];
  rewriteRequired: boolean;
  rewriteInstructions: string;
};

export type RewriteArticleInput = {
  title: string;
  markdown: string;
  reviewProblemsJson: string;
  rewriteInstructions: string;
};

export type RewriteArticleResult = {
  title: string;
  excerpt: string;
  markdown: string;
  changeSummary: string[];
  riskNotes: string[];
};

export interface AIProvider {
  generatePrompt(input: GeneratePromptInput): Promise<{ result: GeneratePromptResult; usage: TokenUsage }>;
  analyzeMaterial(input: AnalyzeMaterialInput): Promise<{ result: AnalyzeMaterialResult; usage: TokenUsage }>;
  generateArticle(input: GenerateArticleInput): Promise<{ result: GenerateArticleResult; usage: TokenUsage }>;
  reviewArticle(input: ReviewArticleInput): Promise<{ result: ReviewArticleResult; usage: TokenUsage }>;
  rewriteArticle(input: RewriteArticleInput): Promise<{ result: RewriteArticleResult; usage: TokenUsage }>;
  generateTrackPrompt(input: GenerateTrackPromptInput): Promise<{ result: GenerateTrackPromptResult; usage: TokenUsage }>;
}

// ─── Track Prompt (Phase 23) ─────────────────────────────────

export type TrackPromptArticleInput = {
  id: string;
  title: string;
  sourceUrl?: string | null;
  summary?: string | null;
  fullContent: string;
  readCount?: number;
  likeCount?: number;
  publishedAt?: string | null;
};

export type GenerateTrackPromptInput = {
  name: string;
  domainName: string;
  targetAudience: string;
  authorPersona: string;
  articles: TrackPromptArticleInput[];
  userNotes?: string;
};

export type MaterialArticleAnalysis = {
  titlePatterns: string[];
  openingHooks: string[];
  emotionalTriggers: string[];
  structurePatterns: string[];
  materialUsage: string[];
  goldenSentences: string[];
  riskNotes: string[];
  doNotCopy: string[];
};

export type GenerateTrackPromptResult = {
  name: string;
  summary: string;
  content: string;
  articleAnalyses: Array<{
    articleId: string;
    title: string;
    analysis: MaterialArticleAnalysis;
  }>;
  trackInsights: {
    commonTitlePatterns: string[];
    commonOpenings: string[];
    commonStructures: string[];
    commonEmotions: string[];
    readerPainPoints: string[];
    reusableAngles: string[];
    forbiddenRules: string[];
  };
  recommendedInputs: string[];
  titleRules: string[];
  structureRules: string[];
  styleRules: string[];
  materialRules: string[];
  forbiddenRules: string[];
};
