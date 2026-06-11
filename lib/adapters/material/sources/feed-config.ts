/**
 * Phase 24: Curated Chinese RSS feed configuration.
 * Each entry maps a feed URL → platform + domain hint.
 * Domain hints are matched against MaterialDomain.name with contains/insensitive.
 */
import type { FeedConfig } from "./rss-source";

export const FEEDS: FeedConfig[] = [
  // ─── 科技 ───
  {
    url: "https://www.36kr.com/feed",
    name: "36氪",
    platform: "website",
    domainHint: "科技",
  },
  {
    url: "https://www.huxiu.com/rss/0.xml",
    name: "虎嗅",
    platform: "website",
    domainHint: "科技",
  },
  {
    url: "https://www.geekpark.net/feed",
    name: "极客公园",
    platform: "website",
    domainHint: "科技",
  },
  {
    url: "https://www.ifanr.com/feed",
    name: "爱范儿",
    platform: "website",
    domainHint: "科技",
  },
  {
    url: "https://www.pingwest.com/feed",
    name: "品玩",
    platform: "website",
    domainHint: "科技",
  },

  // ─── 财经 ───
  {
    url: "https://www.cls.cn/api/sw?app=feed",
    name: "财联社",
    platform: "website",
    domainHint: "财经",
  },
  {
    url: "https://feedx.net/rss/eastmoney.xml",
    name: "东方财富",
    platform: "website",
    domainHint: "财经",
  },

  // ─── 创业/商业 ───
  {
    url: "https://www.cyzone.cn/rss",
    name: "创业邦",
    platform: "website",
    domainHint: "科技",
  },
  {
    url: "https://www.lieyunwang.com/feed",
    name: "猎云网",
    platform: "website",
    domainHint: "科技",
  },

  // ─── 教育 ───
  {
    url: "https://www.jiemodui.com/rss",
    name: "芥末堆",
    platform: "website",
    domainHint: "教育",
  },

  // ─── 综合/生活 ───
  {
    url: "https://www.jiemian.com/lists/feed",
    name: "界面新闻",
    platform: "website",
    domainHint: "财经",
  },
  {
    url: "https://www.thepaper.cn/rss_www.xml",
    name: "澎湃新闻",
    platform: "website",
    domainHint: "综合",
  },

  // ─── 微信优质内容（通过 RSSHub 桥接） ───
  {
    url: "https://rsshub.app/wechat/mp/msgalbum/MzA3NTI1OTkyMA==/316035",
    name: "LateNews",
    platform: "wechat",
    domainHint: "科技",
  },
  {
    url: "https://rsshub.app/zhihu/people/activities/jixin",
    name: "极客吐司",
    platform: "zhihu",
    domainHint: "科技",
  },

  // ─── 备用：少数派 ───
  {
    url: "https://sspai.com/feed",
    name: "少数派",
    platform: "website",
    domainHint: "科技",
  },
];
