"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { TrackDeconstruction } from "@/components/feature/materials/TrackDeconstruction";

type Account = { id: string; platform: string; name: string; avatarUrl: string|null; domainName: string|null; avgTopReadCount: number; avgReadCount: number; postCountDaily: number|string; likeCountTotal: number; originalIndex: number|string; rank: number; isFavorited: boolean; };
type Topic = { id: string; platform: string; title: string; url: string | null; rank: number; heatScore: number | string; snapshotAt: string; };

const SEGMENTS = ["全部", "热门", "情感", "职场", "认知", "搞笑", "教育", "科技", "财经", "故事", "生活", "美食", "更多"] as const;
const TABS = [
  { key: "accounts", label: "公众号榜单" },
  { key: "topics", label: "热搜榜" },
  { key: "articles", label: "文章素材" },
  { key: "guide", label: "如何找对标" }, { key: "deconstruct", label: "爆文拆解" },
] as const;

export function MaterialsClient() {
  const [activeTab, setActiveTab] = useState<string>("accounts");
  const [activeSegment, setActiveSegment] = useState<string>("全部");
  const [keyword, setKeyword] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // Account data
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loadingA, setLoadingA] = useState(true);
  const [loadingT, setLoadingT] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let c = false;
    async function load() {
      setLoadingA(true); setError("");
      try {
        const p = new URLSearchParams();
        if (keyword) p.set("keyword", keyword);
        p.set("page", "1"); p.set("pageSize", "20"); p.set("sortBy", "rank"); p.set("sortOrder", "asc");
        const r = await fetch(`/api/material/accounts?${p}`); const b = await r.json();
        if (c) return;
        if (!b.success) { setError(b.error?.message ?? "加载失败"); return; }
        setAccounts(b.data.items);
      } catch { if (!c) setError("网络错误"); }
      finally { if (!c) setLoadingA(false); }
    }
    load(); return () => { c = true; };
  }, [keyword]);

  useEffect(() => {
    let c = false;
    async function load() {
      setLoadingT(true);
      try {
        const p = new URLSearchParams(); p.set("page", "1"); p.set("pageSize", "10");
        const r = await fetch(`/api/material/hot-topics?${p}`); const b = await r.json();
        if (c) return;
        if (b.success) setTopics(b.data.items);
      } catch {}
      finally { if (!c) setLoadingT(false); }
    }
    load(); return () => { c = true; };
  }, []);

  function handleSearch(e: React.FormEvent) { e.preventDefault(); setKeyword(searchInput); }

  async function handleFavorite(accountId: string, f: boolean) {
    if (f) return;
    try {
      const r = await fetch("/api/material/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetType: "account", targetId: accountId }) });
      const b = await r.json();
      if (b.success) setAccounts(prev => prev.map(a => a.id === accountId ? { ...a, isFavorited: true } : a));
    } catch {}
  }

  return (
    <div className="glass-page depth-page pt-6 pb-20 px-6">
      <div className="mx-auto max-w-6xl">
        {/* Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-900">爆款素材</h1>
          <p className="mt-1 text-sm text-zinc-500">搜索发现全网爆款内容，获取创作灵感</p>
        </div>

        {/* Large search */}
        <form onSubmit={handleSearch} className="mb-6">
          <div className="relative">
            <input
              type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)}
              placeholder="搜索标题、关键词、作者、话题..."
              className="glass-input glass-input-lg w-full !pr-28"
            />
            <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 glass-btn-primary !text-sm !py-2 !px-5">
              搜索
            </button>
          </div>
        </form>

        {/* Tab bar */}
        <div className="flex items-center gap-3 mb-6">
          <div className="glass-segmented">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)} className={activeTab === t.key ? "active" : ""}>{t.label}</button>
            ))}
          </div>
        </div>

        {/* Segment pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          {SEGMENTS.map(s => (
            <button key={s} onClick={() => setActiveSegment(s)}
              className={`${activeSegment === s ? "glass-pill-active" : ""} glass-pill`}>{s}</button>
          ))}
        </div>

        {/* Content: two-column for accounts list + sidebar */}
        {activeTab === "accounts" && (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Main: Account list */}
            <div className="flex-1 lg:w-[70%]">
              <div className="glass-card overflow-hidden">
                <div className="px-5 py-4 border-b border-black/5">
                  <h2 className="font-semibold text-zinc-900">今日爆款</h2>
                </div>
                {loadingA && <p className="text-sm text-zinc-400 p-8 text-center">加载中...</p>}
                {error && <p className="text-sm text-red-500 p-8 text-center">{error}</p>}
                {!loadingA && !error && accounts.length === 0 && <p className="text-sm text-zinc-400 p-8 text-center">暂无数据</p>}
                {!loadingA && !error && accounts.length > 0 && (
                  <table className="glass-table">
                    <thead><tr>
                      <th>#</th><th>名称</th><th>行业</th><th className="text-right">头条阅读</th><th className="text-right">均阅</th><th className="text-right">点赞</th><th>操作</th>
                    </tr></thead>
                    <tbody>
                      {accounts.map(a => (
                        <tr key={a.id}>
                          <td className="font-medium text-zinc-400">{a.rank}</td>
                          <td>
                            <div className="flex items-center gap-2.5">
                              {a.avatarUrl ? <Image src={a.avatarUrl} alt="" width={28} height={28} className="rounded-full" /> : <div className="w-7 h-7 rounded-full bg-zinc-200" />}
                              <span className="font-medium text-zinc-900">{a.name}</span>
                            </div>
                          </td>
                          <td className="text-zinc-400">{a.domainName ?? "-"}</td>
                          <td className="text-right font-medium">{a.avgTopReadCount.toLocaleString()}</td>
                          <td className="text-right">{a.avgReadCount.toLocaleString()}</td>
                          <td className="text-right">{a.likeCountTotal.toLocaleString()}</td>
                          <td>
                            <button onClick={() => handleFavorite(a.id, a.isFavorited)}
                              className={`text-xs px-2.5 py-1 rounded-full font-medium ${a.isFavorited ? "bg-amber-50 text-amber-600" : "text-zinc-400 hover:text-zinc-600"}`}>
                              {a.isFavorited ? "已收藏" : "收藏"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Sidebar: Rankings + Hot Topics */}
            <div className="lg:w-[30%] space-y-4">
              {/* Creator rankings */}
              <div className="glass-panel p-5">
                <h3 className="font-semibold text-zinc-900 mb-3">创作者排行榜</h3>
                <div className="space-y-2">
                  {accounts.slice(0, 5).map((a, i) => (
                    <div key={a.id} className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? "bg-gradient-to-br from-sky-400 to-teal-400 text-white" : "bg-zinc-100 text-zinc-500"}`}>{i + 1}</span>
                      {a.avatarUrl ? <Image src={a.avatarUrl} alt="" width={24} height={24} className="rounded-full" /> : <div className="w-6 h-6 rounded-full bg-zinc-200" />}
                      <span className="text-sm text-zinc-700 truncate flex-1">{a.name}</span>
                      <span className="text-xs text-zinc-400">{a.avgTopReadCount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hot Topics sidebar */}
              <div className="glass-panel p-5">
                <h3 className="font-semibold text-zinc-900 mb-3">热门话题</h3>
                {loadingT ? <p className="text-xs text-zinc-400">加载中...</p> : (
                  <div className="space-y-2">
                    {topics.slice(0, 8).map(t => (
                      <div key={t.id} className="flex items-center gap-2 text-sm">
                        <span className={`text-xs font-bold w-5 ${t.rank <= 3 ? "text-red-500" : "text-zinc-400"}`}>{t.rank}</span>
                        <span className="text-zinc-700 truncate flex-1">{t.title}</span>
                        <span className="text-xs text-zinc-400 shrink-0">{String(t.heatScore)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Topics tab */}
        {activeTab === "topics" && (
          <div className="glass-card p-5">
            <h2 className="font-semibold text-zinc-900 mb-4">热搜榜</h2>
            {loadingT ? <p className="text-sm text-zinc-400 p-8 text-center">加载中...</p> : (
              <div className="space-y-1">
                {topics.map(t => (
                  <div key={t.id} className="flex items-center gap-4 py-3 border-b border-black/5 last:border-0">
                    <span className={`text-lg font-bold w-8 ${t.rank <= 3 ? "text-red-500" : "text-zinc-400"}`}>{t.rank}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-900 truncate">{t.title}</p>
                      <p className="text-xs text-zinc-400">{t.platform} · 热度 {String(t.heatScore)}</p>
                    </div>
                    {t.url && <a href={t.url} target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-400 hover:text-zinc-600 shrink-0">查看</a>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Articles placeholder */}
        {activeTab === "articles" && (
          <div className="glass-card p-5">
            <h2 className="font-semibold text-zinc-900 mb-4">文章素材</h2>
            <p className="text-sm text-zinc-400">搜索关键词以查找文章素材</p>
          </div>
        )}

        {/* Guide placeholder */}
        {activeTab === "guide" && (
          <div className="glass-card p-8">
            <h2 className="font-semibold text-zinc-900 text-lg mb-6">如何找对标</h2>
            <div className="space-y-4">
              {[
                { step: "1", title: "确定你的赛道", desc: "选择内容领域，如财经、科技、健康、教育等，先定位再对标。" },
                { step: "2", title: "利用公众号榜单", desc: "按行业筛选，查看排名靠前的公众号，关注其阅读数、点赞数和原创指数。" },
                { step: "3", title: "利用热搜榜", desc: "查看各平台当前热门话题，热点话题往往是爆款文章的选题来源。" },
                { step: "4", title: "收藏对标账号", desc: "点击「收藏」按钮保存对标账号，方便随时回顾。" },
                { step: "5", title: "引用创作", desc: "找到对标素材后，点击「引用创作」按钮，AI 自动生成高分文章。" },
              ].map(({ step, title, desc }) => (
                <div key={step} className="glass-tile p-4 flex gap-4">
                  <span className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-teal-400 text-white flex items-center justify-center text-sm font-bold shrink-0">{step}</span>
                  <div>
                    <h3 className="font-semibold text-zinc-900 text-sm">{title}</h3>
                    <p className="text-sm text-zinc-500 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "deconstruct" && <TrackDeconstruction />}
      </div>
    </div>
  );
}
