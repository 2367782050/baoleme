import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...\n");

  // ─── Membership Plans ────────────────────────────────────────
  const freePlan = await prisma.membershipPlan.upsert({
    where: { code: "free" },
    update: {},
    create: {
      code: "free",
      name: "免费版",
      priceCents: 0,
      originalPriceCents: 0,
      durationDays: 36500, // ~100 years
      isActive: true,
      capabilities: {
        prompt_generate_monthly: 5,
        article_generate_daily: 1,
        material_export_daily: 10,
        image_upload_daily: 5,
        draft_push_daily: 1,
        official_account_limit: 1,
      },
    },
  });
  console.log(`  Plan: ${freePlan.name} (${freePlan.code})`);

  const proPlan = await prisma.membershipPlan.upsert({
    where: { code: "pro" },
    update: {},
    create: {
      code: "pro",
      name: "专业版",
      priceCents: 2900,
      originalPriceCents: 5900,
      durationDays: 30,
      isActive: true,
      capabilities: {
        prompt_generate_monthly: 100,
        article_generate_daily: 20,
        material_export_daily: 1000,
        image_upload_daily: 50,
        draft_push_daily: 100,
        official_account_limit: 20,
      },
    },
  });
  console.log(`  Plan: ${proPlan.name} (${proPlan.code})`);

  const enterprisePlan = await prisma.membershipPlan.upsert({
    where: { code: "enterprise" },
    update: {},
    create: {
      code: "enterprise",
      name: "企业版",
      priceCents: 9900,
      originalPriceCents: 19900,
      durationDays: 365,
      isActive: true,
      capabilities: {
        prompt_generate_monthly: 500,
        article_generate_daily: 100,
        material_export_daily: 5000,
        image_upload_daily: 200,
        draft_push_daily: 500,
        official_account_limit: 100,
      },
    },
  });
  console.log(`  Plan: ${enterprisePlan.name} (${enterprisePlan.code})`);

  // ─── Admin User ──────────────────────────────────────────────
  const adminPasswordHash = await bcrypt.hash("admin123", 10);

  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      email: "admin@baoleme.local",
      passwordHash: adminPasswordHash,
      role: "admin",
      referralCode: "ADMIN001",
      status: "active",
    },
  });
  console.log(`  Admin: ${admin.username} (admin@baoleme.local / admin123)`);

  // Give admin a trial membership
  const existingMembership = await prisma.userMembership.findFirst({
    where: { userId: admin.id, planId: proPlan.id },
  });
  if (!existingMembership) {
    await prisma.userMembership.create({
      data: {
        userId: admin.id,
        planId: proPlan.id,
        startsAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        status: "active",
        source: "admin",
      },
    });
    console.log(`  Admin membership: pro (active)`);
  }

  // ─── Seed membership codes for testing ──────────────────────
  const testCodeHash = crypto.createHash("sha256").update("TESTVIP2026").digest("hex");
  const existingCode = await prisma.membershipCode.findFirst({ where: { codeHash: testCodeHash } });
  if (!existingCode) {
    await prisma.membershipCode.create({
      data: { codeHash: testCodeHash, planId: proPlan.id, status: "unused" },
    });
    console.log("  Membership code: TESTVIP2026 → 专业版");
  }

  // ─── Material Domains (Industries) ───────────────────────────
  const domainData = [
    { name: "财经理财", children: ["股票投资", "基金理财", "保险保障", "房产楼市"] },
    { name: "科技互联网", children: ["人工智能", "互联网创业", "数码产品", "软件开发"] },
    { name: "健康养生", children: ["中医养生", "运动健身", "心理健康", "营养饮食"] },
    { name: "教育成长", children: ["职场技能", "考研考公", "家庭教育", "语言学习"] },
    { name: "情感生活", children: ["恋爱关系", "婚姻家庭", "个人成长", "社交沟通"] },
    { name: "娱乐文化", children: ["影视综艺", "音乐舞蹈", "读书写作", "旅行美食"] },
    { name: "时尚美妆", children: ["穿搭搭配", "护肤化妆", "美发美甲", "潮流资讯"] },
    { name: "汽车出行", children: ["新车评测", "二手车", "新能源车", "汽车文化"] },
  ];

  for (const cat of domainData) {
    let parent = await prisma.materialDomain.findFirst({
      where: { name: cat.name, parentId: null },
    });
    if (!parent) {
      parent = await prisma.materialDomain.create({
        data: { name: cat.name, sortOrder: 0 },
      });
    }

    for (let i = 0; i < cat.children.length; i++) {
      const existing = await prisma.materialDomain.findFirst({
        where: { name: cat.children[i], parentId: parent.id },
      });
      if (!existing) {
        await prisma.materialDomain.create({
          data: {
            name: cat.children[i],
            parentId: parent.id,
            sortOrder: i + 1,
          },
        });
      }
    }
    console.log(`  Domain: ${cat.name} (+ ${cat.children.length} sub)`);
  }

  // ─── Sample Material Accounts ──────────────────────────────────
  const financeDomain = await prisma.materialDomain.findFirst({
    where: { name: "股票投资" },
  });
  const techDomain = await prisma.materialDomain.findFirst({
    where: { name: "互联网创业" },
  });

  if (financeDomain && techDomain) {
    const sampleAccounts = [
      {
        platform: "wechat",
        name: "财经早餐",
        domainId: financeDomain.id,
        avgTopReadCount: 150000,
        avgReadCount: 45000,
        postCountDaily: 3,
        likeCountTotal: 32000,
        originalIndex: 92.5,
        rank: 1,
        sourceProvider: "seed",
        snapshotDate: new Date(),
      },
      {
        platform: "wechat",
        name: "投资人说",
        domainId: financeDomain.id,
        avgTopReadCount: 120000,
        avgReadCount: 38000,
        postCountDaily: 2,
        likeCountTotal: 28000,
        originalIndex: 88.3,
        rank: 2,
        sourceProvider: "seed",
        snapshotDate: new Date(),
      },
      {
        platform: "xiaohongshu",
        name: "商业观察局",
        domainId: techDomain.id,
        avgTopReadCount: 95000,
        avgReadCount: 32000,
        postCountDaily: 4,
        likeCountTotal: 45000,
        originalIndex: 85.1,
        rank: 1,
        sourceProvider: "seed",
        snapshotDate: new Date(),
      },
    ];

    for (const acc of sampleAccounts) {
      const existing = await prisma.materialAccount.findFirst({
        where: {
          platform: acc.platform,
          name: acc.name,
          sourceProvider: acc.sourceProvider,
        },
      });
      if (!existing) {
        await prisma.materialAccount.create({ data: acc });
        console.log(`  Account: ${acc.name} (${acc.platform})`);
      }
    }

    // Add sample articles for the accounts
    const account1 = await prisma.materialAccount.findFirst({
      where: { platform: "wechat", name: "财经早餐", sourceProvider: "seed" },
    });
    const account2 = await prisma.materialAccount.findFirst({
      where: { platform: "xiaohongshu", name: "商业观察局", sourceProvider: "seed" },
    });

    if (account1) {
      const existingArticles = await prisma.materialArticle.count({
        where: { accountId: account1.id, sourceProvider: "seed" },
      });
      if (existingArticles === 0) {
        await prisma.materialArticle.createMany({
          data: [
            {
              platform: "wechat",
              accountId: account1.id,
              domainId: financeDomain!.id,
              title: "2026年下半年投资策略：防御性配置思路",
              sourceUrl: "https://example.com/article/1",
              summary: "在市场不确定性增加的背景下，防御性资产配置策略成为投资者的首选。",
              coverUrl: "https://picsum.photos/seed/art1/400/200",
              readCount: 120000,
              likeCount: 8500,
              commentCount: 320,
              publishedAt: new Date("2026-05-15"),
              sourceProvider: "seed",
            },
            {
              platform: "wechat",
              accountId: account1.id,
              domainId: financeDomain!.id,
              title: "AI 概念股还能涨多久？机构最新研判",
              sourceUrl: "https://example.com/article/2",
              summary: "多家研究机构发布AI行业下半年展望，分歧加大。",
              coverUrl: "https://picsum.photos/seed/art2/400/200",
              readCount: 98000,
              likeCount: 6200,
              commentCount: 410,
              publishedAt: new Date("2026-05-14"),
              sourceProvider: "seed",
            },
          ],
        });
        console.log("  Articles: 2 sample articles for 财经早餐");
      }
    }
    if (account2) {
      const existingArticles = await prisma.materialArticle.count({
        where: { accountId: account2.id, sourceProvider: "seed" },
      });
      if (existingArticles === 0) {
        await prisma.materialArticle.createMany({
          data: [
            {
              platform: "xiaohongshu",
              accountId: account2.id,
              domainId: techDomain!.id,
              title: "创业3年，我学到的5条管理铁律",
              sourceUrl: "https://example.com/article/3",
              summary: "从0到100人的团队管理心得，每一条都是踩坑总结。",
              coverUrl: "https://picsum.photos/seed/art3/400/200",
              readCount: 45000,
              likeCount: 3200,
              commentCount: 180,
              publishedAt: new Date("2026-05-10"),
              sourceProvider: "seed",
            },
          ],
        });
        console.log("  Articles: 1 sample article for 商业观察局");
      }
    }
  }

  // ─── Sample Hot Topics ──────────────────────────────────────
  const hotTopicData = [
    {
      platform: "wechat",
      title: "2026年普通人如何抓住AI红利",
      url: "https://example.com/hot/1",
      rank: 1,
      heatScore: 9850,
      snapshotAt: new Date(),
    },
    {
      platform: "wechat",
      title: "存款利率再次下调影响几何",
      url: "https://example.com/hot/2",
      rank: 2,
      heatScore: 8720,
      snapshotAt: new Date(),
    },
    {
      platform: "xiaohongshu",
      title: "35岁后如何在职场持续增值",
      url: "https://example.com/hot/3",
      rank: 3,
      heatScore: 7650,
      snapshotAt: new Date(),
    },
  ];

  let topicCount = 0;
  for (const topic of hotTopicData) {
    const existing = await prisma.hotTopic.findFirst({
      where: {
        platform: topic.platform,
        title: topic.title,
        url: topic.url,
      },
    });
    if (!existing) {
      await prisma.hotTopic.create({ data: topic });
      topicCount++;
    }
  }
  console.log(`  Hot topics: ${topicCount} new (of ${hotTopicData.length})`);

  console.log("\nSeed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
