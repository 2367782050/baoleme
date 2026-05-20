/**
 * Phase 19: Real AI acceptance test script.
 *
 * Usage:
 *   npm run verify:ai
 *
 * Behavior:
 * - If AI_PROVIDER is mock or no API_KEY: prints Chinese message, exits 0
 * - If configured: calls generatePrompt + generateArticle, validates output
 *
 * NEVER included in CI default pipeline.
 */

import "dotenv/config";

async function main() {
  const provider = process.env.AI_PROVIDER ?? "mock";
  const apiKey = process.env.AI_API_KEY;
  const baseUrl = process.env.AI_BASE_URL;
  const model = process.env.AI_MODEL;

  if (provider === "mock" || !apiKey) {
    console.log("当前未配置真实 AI，跳过真实模型验收。");
    console.log("如需真实 AI 验收，请设置环境变量：");
    console.log("  AI_PROVIDER=openai-compatible");
    console.log("  AI_BASE_URL=https://api.deepseek.com/v1");
    console.log("  AI_API_KEY=sk-xxx");
    console.log("  AI_MODEL=deepseek-chat");
    console.log("  AI_TIMEOUT_MS=30000");
    process.exit(0);
  }

  console.log(`AI 配置: provider=${provider}, model=${model}, baseUrl=${baseUrl}`);
  console.log("开始真实 AI 验收...\n");

  const { createConfiguredProvider } = await import("../lib/adapters/ai/openai-provider.js");

  let providerInstance;
  try {
    providerInstance = await createConfiguredProvider();
  } catch (e) {
    console.error("❌ AI Provider 初始化失败:", (e as Error).message);
    process.exit(1);
  }

  // Test 1: generatePrompt
  console.log("1/2 提示词生成...");
  try {
    const { result } = await providerInstance.generatePrompt({
      name: "验收测试提示词",
      contentDomain: "财经",
      targetAudience: "职场人士和理财人群",
      authorName: "财经观察者",
      personaDetails: "长期关注宏观经济",
      personalityTraits: ["理性分析型", "数据驱动型"],
      headingStyle: "numbered",
      wordCount: 1500,
      enableAIDetectionEvasion: true,
      materialAnalysisJson: "{}",
      userNotes: "请输出一个可用于生产环境的提示词",
    });

    if (!result.content || result.content.length < 50) {
      console.error("❌ 提示词生成：内容过短或为空");
      process.exit(1);
    }

    const chineseRatio = (result.content.match(/[一-鿿]/g)?.length ?? 0) / result.content.length;
    if (chineseRatio < 0.3) {
      console.error(`❌ 提示词生成：中文比例过低 (${(chineseRatio * 100).toFixed(1)}%)`);
      process.exit(1);
    }

    console.log(`   ✅ 提示词: "${result.name}"`);
    console.log(`   📝 摘要: ${result.summary?.substring(0, 100) ?? ""}`);
    console.log(`   📏 长度: ${result.content.length} 字`);
  } catch (e) {
    console.error("❌ 提示词生成失败:", (e as Error).message);
    process.exit(1);
  }

  // Test 2: generateArticle
  console.log("\n2/2 文章生成...");
  try {
    const { result } = await providerInstance.generateArticle({
      title: "2026年AI行业发展展望",
      promptContent: "",
      materialAnalysisJson: "{}",
      referenceUrls: [],
      materialText: "AI技术正在快速发展，应用场景不断扩大。",
      wordCount: 800,
      imageCount: 0,
      imageStrategy: "none",
      headingStyle: "numbered",
      enableAIDetectionEvasion: true,
    });

    if (!result.markdown || result.markdown.length < 30) {
      console.error(`❌ 文章生成：markdown 字段过短或为空 (长度: ${result.markdown?.length ?? 0})`);
      process.exit(1);
    }

    const chineseRatio = (result.markdown.match(/[一-鿿]/g)?.length ?? 0) / result.markdown.length;
    if (chineseRatio < 0.3) {
      console.error(`❌ 文章生成：中文比例过低 (${(chineseRatio * 100).toFixed(1)}%)`);
      process.exit(1);
    }

    console.log(`   ✅ 标题: "${result.title}"`);
    console.log(`   📝 摘要: ${result.excerpt?.substring(0, 100) ?? ""}`);
    console.log(`   📏 正文: ${result.markdown.length} 字`);
  } catch (e) {
    console.error("❌ 文章生成失败:", (e as Error).message);
    if ((e as Error).cause) console.error("   原因:", String((e as Error).cause).substring(0, 200));
    process.exit(1);
  }

  console.log("\n🎉 真实 AI 验收全部通过！");
}

main();
