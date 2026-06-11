/**
 * Phase 24: Content quality scoring service.
 * Uses AI to analyze article content and predict viral potential.
 * Gated behind AI_PROVIDER !== "mock" — zero cost when AI is disabled.
 */
import { prisma } from "@/lib/db";

export interface ContentQualityScore {
  titleViralPotential: number;    // 0-100
  contentStructureQuality: number; // 0-100
  emotionalResonance: number;      // 0-100
  noveltyScore: number;            // 0-100
  overallViralPotential: number;   // 0-100 weighted average
  reasoning: string;               // brief AI explanation
  scoredAt: string;                // ISO timestamp
}

const SCORING_PROMPT = `你是一位资深自媒体内容分析师。请对以下文章进行"爆款潜力"评分。

评分维度（0-100 分）：
- titleViralPotential: 标题的点击吸引力
- contentStructureQuality: 结构、节奏、可读性
- emotionalResonance: 是否能引发情绪共鸣
- noveltyScore: 内容/观点的独特程度

请返回 JSON：
{
  "titleViralPotential": 数字,
  "contentStructureQuality": 数字,
  "emotionalResonance": 数字,
  "noveltyScore": 数字,
  "overallViralPotential": 数字,
  "reasoning": "一句话总结"
}`;

async function callAI(messages: { role: string; content: string }[]): Promise<string | null> {
  const baseUrl = process.env.AI_BASE_URL;
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL ?? "deepseek-chat";
  const timeoutMs = parseInt(process.env.AI_TIMEOUT_MS ?? "30000", 10);

  if (!baseUrl || !apiKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 1024 }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const body = await res.json();
    return (body.choices?.[0]?.message?.content ?? "").trim();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function scoreArticle(
  articleId: string,
): Promise<ContentQualityScore | null> {
  const article = await prisma.materialArticle.findUnique({
    where: { id: articleId },
    select: { id: true, title: true, summary: true, fullContent: true, analysis: true },
  });
  if (!article) return null;

  const existingAnalysis = article.analysis as Record<string, unknown> | null;
  if (existingAnalysis?.scoredAt) {
    const age = Date.now() - new Date(existingAnalysis.scoredAt as string).getTime();
    if (age < 24 * 60 * 60 * 1000) {
      return existingAnalysis as unknown as ContentQualityScore;
    }
  }

  // Only score if AI provider is configured (not mock)
  if (process.env.AI_PROVIDER === "mock" || !process.env.AI_API_KEY) {
    return null;
  }

  try {
    const contentToAnalyze = (article.fullContent ?? article.summary ?? "").substring(0, 1500);
    if (contentToAnalyze.length < 50) return null;

    const raw = await callAI([
      { role: "system", content: SCORING_PROMPT },
      { role: "user", content: `标题: ${article.title}\n内容: ${contentToAnalyze}` },
    ]);
    if (!raw) return null;

    // Extract JSON from response (handle ```json blocks)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const score = JSON.parse(jsonMatch[0]) as ContentQualityScore;
    score.scoredAt = new Date().toISOString();

    // Store in analysis JSONB
    await prisma.materialArticle.update({
      where: { id: articleId },
      data: { analysis: JSON.parse(JSON.stringify(score)) },
    });

    return score;
  } catch (e) {
    console.error(`[scoring] Failed to score article ${articleId}: ${(e as Error).message}`);
    return null;
  }
}

export async function scoreBatchAfterIngestion(
  articleIds: string[],
  maxConcurrent: number = 3,
): Promise<void> {
  if (process.env.AI_PROVIDER === "mock" || !process.env.AI_API_KEY) return;
  if (articleIds.length === 0) return;

  // Process in batches to respect API rate limits
  for (let i = 0; i < articleIds.length; i += maxConcurrent) {
    const batch = articleIds.slice(i, i + maxConcurrent);
    await Promise.allSettled(batch.map(id => scoreArticle(id)));
  }
}
