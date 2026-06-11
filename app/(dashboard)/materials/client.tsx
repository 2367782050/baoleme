"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { TrackDeconstruction } from "@/components/feature/materials/TrackDeconstruction";

type Account = {
  id: string;
  platform: string;
  name: string;
  avatarUrl: string | null;
  domainName: string | null;
  avgTopReadCount: number;
  avgReadCount: number;
  postCountDaily: number | string;
  likeCountTotal: number;
  originalIndex: number | string;
  rank: number;
  isFavorited: boolean;
};

type Article = {
  id: string;
  platform: string;
  title: string;
  sourceUrl: string | null;
  summary: string | null;
  contentExcerpt: string | null;
  coverUrl: string | null;
  readCount: number;
  likeCount: number;
  commentCount: number;
  publishedAt: string | null;
  sourceProvider: string;
};

type Topic = {
  id: string;
  platform: string;
  title: string;
  url: string | null;
  rank: number;
  heatScore: number | string;
  snapshotAt: string;
};

const SEGMENTS = ["全部", "热门", "情感", "职场", "认知", "搞笑", "教育", "科技", "财经", "故事", "生活", "美食", "更多"] as const;
const TABS = [
  { key: "accounts", label: "对标号" },
  { key: "articles", label: "爆文文章" },
  { key: "topics", label: "今日热搜" },
  { key: "deconstruct", label: "爆文拆解" },
  { key: "guide", label: "如何找对标" },
] as const;

type TabKey = (typeof TABS)[number]["key"];
type ExportType = "accounts" | "articles" | "topics";

function formatNumber(value: number | string) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString();
}

function sourceLabel(source: string) {
  if (source === "seed") return "系统素材";
  if (source === "paste") return "粘贴导入";
  if (source === "url") return "链接抓取";
  return source;
}

export function MaterialsClient() {
  const [activeTab, setActiveTab] = useState<TabKey>("accounts");
  const [activeSegment, setActiveSegment] = useState<string>("全部");
  const [keyword, setKeyword] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingArticles, setLoadingArticles] = useState(true);
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingAccounts(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (keyword) params.set("keyword", keyword);
        params.set("page", "1");
        params.set("pageSize", "20");
        params.set("sortBy", "rank");
        params.set("sortOrder", "asc");
        const res = await fetch(`/api/material/accounts?${params}`);
        const body = await res.json();
        if (cancelled) return;
        if (!body.success) {
          setError(body.error?.message ?? "对标号加载失败");
          return;
        }
        setAccounts(body.data.items);
      } catch {
        if (!cancelled) setError("网络异常，对标号加载失败");
      } finally {
        if (!cancelled) setLoadingAccounts(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [keyword]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingArticles(true);
      try {
        const params = new URLSearchParams();
        if (keyword) params.set("keyword", keyword);
        params.set("page", "1");
        params.set("pageSize", "20");
        const res = await fetch(`/api/material/articles?${params}`);
        const body = await res.json();
        if (!cancelled && body.success) setArticles(body.data.items);
      } catch {
        if (!cancelled) setArticles([]);
      } finally {
        if (!cancelled) setLoadingArticles(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [keyword]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingTopics(true);
      try {
        const params = new URLSearchParams();
        params.set("page", "1");
        params.set("pageSize", "20");
        const res = await fetch(`/api/material/hot-topics?${params}`);
        const body = await res.json();
        if (!cancelled && body.success) setTopics(body.data.items);
      } catch {
        if (!cancelled) setTopics([]);
      } finally {
        if (!cancelled) setLoadingTopics(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setKeyword(searchInput.trim());
  }

  async function copyText(text: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(successMessage);
    } catch {
      setNotice("复制失败，请检查浏览器权限");
    }
  }

  async function handleFavorite(accountId: string, isFavorited: boolean) {
    if (isFavorited) return;
    try {
      const res = await fetch("/api/material/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: "account", targetId: accountId }),
      });
      const body = await res.json();
      if (body.success) {
        setAccounts((prev) => prev.map((a) => (a.id === accountId ? { ...a, isFavorited: true } : a)));
        setNotice("已收藏对标号");
      }
    } catch {
      setNotice("收藏失败，请稍后重试");
    }
  }

  async function handleExport(type: ExportType) {
    try {
      const res = await fetch("/api/material/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, filters: keyword ? { keyword } : {} }),
      });
      const body = await res.json();
      if (!body.success) {
        setNotice(body.error?.message ?? "导出失败");
        return;
      }
      const blob = new Blob([body.data.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `materials-${type}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setNotice("导出成功");
    } catch {
      setNotice("导出失败，请稍后重试");
    }
  }

  return (
    <div className="glass-page depth-page pt-6 pb-20 px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">爆款素材</h1>
            <p className="mt-1 text-sm text-zinc-500">从对标号、爆文、热搜到拆解提示词，完成素材到创作的第一步。</p>
          </div>
          {notice && <p className="rounded-full bg-white/70 px-4 py-2 text-xs text-zinc-600 shadow-sm">{notice}</p>}
        </div>

        <form onSubmit={handleSearch} className="mb-6">
          <div className="relative">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="搜索标题、关键词、作者、话题..."
              className="glass-input glass-input-lg w-full !pr-28"
            />
            <button type="submit" className="glass-btn-primary absolute right-2 top-1/2 -translate-y-1/2 !px-5 !py-2 !text-sm">
              搜索
            </button>
          </div>
        </form>

        <div className="mb-6 overflow-x-auto">
          <div className="glass-segmented inline-flex">
            {TABS.map((tab) => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={activeTab === tab.key ? "active" : ""}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab !== "deconstruct" && (
          <div className="mb-6 flex flex-wrap gap-2">
            {SEGMENTS.map((segment) => (
              <button
                key={segment}
                onClick={() => setActiveSegment(segment)}
                className={`${activeSegment === segment ? "glass-pill-active" : ""} glass-pill`}
              >
                {segment}
              </button>
            ))}
          </div>
        )}

        {activeTab === "accounts" && (
          <div className="flex flex-col gap-6 lg:flex-row">
            <div className="flex-1 lg:w-[70%]">
              <div className="glass-card overflow-hidden">
                <div className="flex items-center justify-between border-b border-black/5 px-5 py-4">
                  <div>
                    <h2 className="font-semibold text-zinc-900">对标号榜单</h2>
                    <p className="text-xs text-zinc-400">按头条阅读、均阅和点赞表现筛选可长期跟踪的账号。</p>
                  </div>
                  <button onClick={() => handleExport("accounts")} className="glass-btn-secondary !px-3 !py-1.5 !text-xs">
                    导出
                  </button>
                </div>
                {loadingAccounts && <p className="p-8 text-center text-sm text-zinc-400">加载中...</p>}
                {error && <p className="p-8 text-center text-sm text-red-500">{error}</p>}
                {!loadingAccounts && !error && accounts.length === 0 && <p className="p-8 text-center text-sm text-zinc-400">暂无数据</p>}
                {!loadingAccounts && !error && accounts.length > 0 && (
                  <table className="glass-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>名称</th>
                        <th>赛道</th>
                        <th className="text-right">头条阅读</th>
                        <th className="text-right">均阅</th>
                        <th className="text-right">点赞</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accounts.map((account) => (
                        <tr key={account.id}>
                          <td className="font-medium text-zinc-400">{account.rank}</td>
                          <td>
                            <div className="flex items-center gap-2.5">
                              {account.avatarUrl ? (
                                <Image src={account.avatarUrl} alt="" width={28} height={28} className="rounded-full" />
                              ) : (
                                <div className="h-7 w-7 rounded-full bg-zinc-200" />
                              )}
                              <span className="font-medium text-zinc-900">{account.name}</span>
                            </div>
                          </td>
                          <td className="text-zinc-400">{account.domainName ?? "-"}</td>
                          <td className="text-right font-medium">{formatNumber(account.avgTopReadCount)}</td>
                          <td className="text-right">{formatNumber(account.avgReadCount)}</td>
                          <td className="text-right">{formatNumber(account.likeCountTotal)}</td>
                          <td>
                            <div className="flex flex-wrap gap-2">
                              <button onClick={() => handleFavorite(account.id, account.isFavorited)} className="text-xs text-zinc-500 hover:text-zinc-800">
                                {account.isFavorited ? "已收藏" : "收藏"}
                              </button>
                              <button onClick={() => copyText(account.name, "已复制账号名称")} className="text-xs text-zinc-500 hover:text-zinc-800">
                                复制标题
                              </button>
                              <span className="text-xs text-zinc-300">查看原文：接口预留，暂未配置</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="space-y-4 lg:w-[30%]">
              <div className="glass-panel p-5">
                <h3 className="mb-3 font-semibold text-zinc-900">账号观察清单</h3>
                <div className="space-y-2">
                  {accounts.slice(0, 5).map((account, index) => (
                    <div key={account.id} className="flex items-center gap-3">
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${index < 3 ? "bg-gradient-to-br from-sky-400 to-teal-400 text-white" : "bg-zinc-100 text-zinc-500"}`}>
                        {index + 1}
                      </span>
                      <span className="flex-1 truncate text-sm text-zinc-700">{account.name}</span>
                      <span className="shrink-0 text-xs text-zinc-400">{formatNumber(account.avgTopReadCount)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-panel p-5">
                <h3 className="mb-3 font-semibold text-zinc-900">今日热搜侧栏</h3>
                {loadingTopics ? (
                  <p className="text-xs text-zinc-400">加载中...</p>
                ) : (
                  <div className="space-y-2">
                    {topics.slice(0, 8).map((topic) => (
                      <div key={topic.id} className="flex items-center gap-2 text-sm">
                        <span className={`w-5 text-xs font-bold ${topic.rank <= 3 ? "text-red-500" : "text-zinc-400"}`}>{topic.rank}</span>
                        <span className="flex-1 truncate text-zinc-700">{topic.title}</span>
                        <span className="shrink-0 text-xs text-zinc-400">{String(topic.heatScore)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "articles" && (
          <div className="glass-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-black/5 px-5 py-4">
              <div>
                <h2 className="font-semibold text-zinc-900">爆文文章</h2>
                <p className="text-xs text-zinc-400">优先挑选可复用的标题结构、开头钩子和选题角度。</p>
              </div>
              <button onClick={() => handleExport("articles")} className="glass-btn-secondary !px-3 !py-1.5 !text-xs">
                导出
              </button>
            </div>
            {loadingArticles && <p className="p-8 text-center text-sm text-zinc-400">加载中...</p>}
            {!loadingArticles && articles.length === 0 && <p className="p-8 text-center text-sm text-zinc-400">暂无文章素材</p>}
            {!loadingArticles && articles.length > 0 && (
              <div className="divide-y divide-black/5">
                {articles.map((article) => (
                  <div key={article.id} className="flex gap-4 p-5">
                    {article.coverUrl && <Image src={article.coverUrl} alt="" width={80} height={64} className="h-16 w-20 rounded-lg object-cover" />}
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold text-zinc-900">{article.title}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-zinc-500">{article.summary ?? article.contentExcerpt ?? "暂无摘要"}</p>
                      <p className="mt-2 text-xs text-zinc-400">
                        {article.platform} · {sourceLabel(article.sourceProvider)} · 阅读 {formatNumber(article.readCount)} · 点赞 {formatNumber(article.likeCount)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2 text-xs">
                      <button onClick={() => copyText(article.title, "已复制标题")} className="text-zinc-500 hover:text-zinc-800">
                        复制标题
                      </button>
                      {article.sourceUrl ? (
                        <>
                          <button onClick={() => copyText(article.sourceUrl!, "已复制链接")} className="text-zinc-500 hover:text-zinc-800">
                            复制链接
                          </button>
                          <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">
                            查看原文
                          </a>
                        </>
                      ) : (
                        <span className="text-zinc-300">链接接口预留</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "topics" && (
          <div className="glass-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-black/5 px-5 py-4">
              <div>
                <h2 className="font-semibold text-zinc-900">今日热搜</h2>
                <p className="text-xs text-zinc-400">把热点当作选题入口，避免直接搬运平台内容。</p>
              </div>
              <button onClick={() => handleExport("topics")} className="glass-btn-secondary !px-3 !py-1.5 !text-xs">
                导出
              </button>
            </div>
            {loadingTopics ? (
              <p className="p-8 text-center text-sm text-zinc-400">加载中...</p>
            ) : (
              <div className="divide-y divide-black/5">
                {topics.map((topic) => (
                  <div key={topic.id} className="flex items-center gap-4 px-5 py-3">
                    <span className={`w-8 text-lg font-bold ${topic.rank <= 3 ? "text-red-500" : "text-zinc-400"}`}>{topic.rank}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900">{topic.title}</p>
                      <p className="text-xs text-zinc-400">
                        {topic.platform} · 热度 {String(topic.heatScore)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-3 text-xs">
                      <button onClick={() => copyText(topic.title, "已复制标题")} className="text-zinc-500 hover:text-zinc-800">
                        复制标题
                      </button>
                      {topic.url ? (
                        <>
                          <button onClick={() => copyText(topic.url!, "已复制链接")} className="text-zinc-500 hover:text-zinc-800">
                            复制链接
                          </button>
                          <a href={topic.url} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">
                            查看原文
                          </a>
                        </>
                      ) : (
                        <span className="text-zinc-300">接口预留，暂未配置</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "deconstruct" && <TrackDeconstruction />}

        {activeTab === "guide" && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[
              { step: "1", title: "先定赛道", desc: "明确内容领域、目标读者和商业目标，只跟踪同赛道账号。" },
              { step: "2", title: "看稳定表现", desc: "优先关注持续高阅读、高互动、更新稳定的账号，不只看单篇爆文。" },
              { step: "3", title: "拆结构不抄内容", desc: "记录标题结构、开头钩子、论证路径和素材组织方式，避免复制原文表达。" },
              { step: "4", title: "建立素材池", desc: "收藏对标号，保存爆文链接，把 3-10 篇同类文章送入爆文拆解生成提示词。" },
            ].map((item) => (
              <div key={item.step} className="glass-tile flex gap-4 p-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-teal-400 text-sm font-bold text-white">
                  {item.step}
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">{item.title}</h3>
                  <p className="mt-1 text-sm text-zinc-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
