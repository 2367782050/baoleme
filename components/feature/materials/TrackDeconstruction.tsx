"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useModal } from "@/components/ui/modal";

type Domain = { id: string; name: string };
type ImportedArticle = {
  id: string; title: string; domainId: string; domain: { name: string } | null;
  contentLength: number; importSource: string; createdAt: string;
};

export function TrackDeconstruction() {
  const modal = useModal();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [articles, setArticles] = useState<ImportedArticle[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loadingA, setLoadingA] = useState(false);
  // Paste form
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteDomainId, setPasteDomainId] = useState("");
  const [pasteContent, setPasteContent] = useState("");
  const [pasteUrl, setPasteUrl] = useState("");
  // URL form
  const [urlInput, setUrlInput] = useState("");
  const [urlDomainId, setUrlDomainId] = useState("");
  // Filter
  const [filterDomain, setFilterDomain] = useState("");
  // Generate
  const [gpName, setGpName] = useState("");
  const [gpAudience, setGpAudience] = useState("");
  const [gpPersona, setGpPersona] = useState("");
  const [gpNotes, setGpNotes] = useState("");
  const [gpGroupId, setGpGroupId] = useState("");
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState("");
  const [genError, setGenError] = useState("");

  useEffect(() => {
    fetch("/api/material/domains").then(r => r.json()).then(b => { if (b.success) setDomains(b.data); }).catch(() => {});
    fetch("/api/prompts/groups").then(r => r.json()).then(b => { if (b.success) setGroups(b.data); }).catch(() => {});
    refreshArticles();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterDomain]);

  async function refreshArticles() {
    setLoadingA(true);
    const p = new URLSearchParams(); if (filterDomain) p.set("domainId", filterDomain); p.set("pageSize", "50");
    const r = await fetch(`/api/material/imported-articles?${p}`);
    const b = await r.json();
    if (b.success) setArticles(b.data.items);
    setLoadingA(false);
  }

  async function handlePaste(e: React.FormEvent) {
    e.preventDefault();
    if (!pasteTitle || !pasteContent || !pasteDomainId) return;
    const r = await fetch("/api/material/articles/import", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "paste", title: pasteTitle, content: pasteContent, domainId: pasteDomainId, sourceUrl: pasteUrl || undefined }),
    });
    const b = await r.json();
    if (b.success) { setPasteTitle(""); setPasteContent(""); setPasteUrl(""); refreshArticles(); }
    else await modal.open({ title: "导入失败", message: b.error?.message ?? "失败" });
  }

  async function handleUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!urlInput || !urlDomainId) return;
    const r = await fetch("/api/material/articles/import", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "url", url: urlInput, domainId: urlDomainId }),
    });
    const b = await r.json();
    if (b.success) { setUrlInput(""); refreshArticles(); }
    else await modal.open({ title: "抓取失败", message: b.error?.message ?? "失败" });
  }

  function toggleSelect(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 10 ? [...prev, id] : prev);
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault(); setGenError(""); setJobId(null);
    if (selected.length < 3) { setGenError("至少选择 3 篇文章"); return; }
    if (!gpName || !gpAudience || !gpPersona) { setGenError("请填写提示词名称、目标读者和作者人设"); return; }
    const fd = filterDomain || articles.find(a => selected.includes(a.id))?.domainId || "";
    const r = await fetch("/api/material/track-prompts/generate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domainId: fd, articleIds: selected, name: gpName, targetAudience: gpAudience, authorPersona: gpPersona, userNotes: gpNotes, groupId: gpGroupId || null }),
    });
    const b = await r.json();
    if (!b.success) { setGenError(b.error?.message ?? "创建失败"); return; }
    setJobId(b.data.jobId); setJobStatus(b.data.status);
    const poll = setInterval(async () => {
      const r2 = await fetch(`/api/prompts/generation-jobs/${b.data.jobId}`); const b2 = await r2.json();
      if (!b2.success) return;
      setJobStatus(b2.data.status);
      if (b2.data.status === "completed") { clearInterval(poll); setSelected([]); }
      if (b2.data.status === "failed") { clearInterval(poll); setGenError(b2.data.errorMessage ?? "生成失败"); }
    }, 1000);
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-500">导入爆款文章全文，AI 拆解共性规律，生成赛道级写作提示词。</p>

      {/* Import methods */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Paste */}
        <div className="glass-panel p-4">
          <h3 className="font-semibold text-zinc-900 mb-3">📋 粘贴全文</h3>
          <form onSubmit={handlePaste} className="space-y-3">
            <input value={pasteTitle} onChange={e => setPasteTitle(e.target.value)} placeholder="文章标题" required className="glass-input w-full text-sm" />
            <select value={pasteDomainId} onChange={e => setPasteDomainId(e.target.value)} required className="glass-input w-full text-sm">
              <option value="">选择赛道</option>{domains.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
            <textarea value={pasteContent} onChange={e => setPasteContent(e.target.value)} placeholder="粘贴全文内容..." required className="glass-input w-full text-sm h-32 resize-y" />
            <input value={pasteUrl} onChange={e => setPasteUrl(e.target.value)} placeholder="来源链接（可选）" className="glass-input w-full text-sm" />
            <button type="submit" className="glass-btn-primary !text-sm !py-1.5 w-full">保存文章</button>
          </form>
        </div>

        {/* URL */}
        <div className="glass-panel p-4">
          <h3 className="font-semibold text-zinc-900 mb-3">🔗 链接抓取</h3>
          <form onSubmit={handleUrl} className="space-y-3">
            <input value={urlInput} onChange={e => setUrlInput(e.target.value)} placeholder="文章 URL" required className="glass-input w-full text-sm" />
            <select value={urlDomainId} onChange={e => setUrlDomainId(e.target.value)} required className="glass-input w-full text-sm">
              <option value="">选择赛道</option>{domains.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
            <button type="submit" className="glass-btn-primary !text-sm !py-1.5 w-full">抓取并保存</button>
          </form>
        </div>

        {/* Third party (disabled) */}
        <div className="glass-panel p-4 opacity-50 pointer-events-none">
          <h3 className="font-semibold text-zinc-900 mb-3">🌐 第三方接口</h3>
          <p className="text-xs text-zinc-400">接口预留，暂未配置</p>
        </div>
      </div>

      {/* Article list with selection */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-zinc-900">已导入文章（勾选 3-10 篇用于生成）</h3>
          <select value={filterDomain} onChange={e => setFilterDomain(e.target.value)} className="glass-input text-sm !py-1">
            <option value="">全部赛道</option>{domains.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
        </div>
        <p className="text-xs text-zinc-400 mb-2">已选择 {selected.length}/10 篇{selected.length < 3 ? "（至少 3 篇）" : ""}</p>
        {loadingA && <p className="text-sm text-zinc-400">加载中...</p>}
        {!loadingA && articles.length === 0 && <p className="text-sm text-zinc-400">暂无导入文章。请先粘贴或抓取。</p>}
        {articles.map(a => (
          <label key={a.id} className="flex items-center gap-3 py-2 border-b border-black/5 cursor-pointer hover:bg-white/30">
            <input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggleSelect(a.id)} className="shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-zinc-800 truncate">{a.title}</p>
              <p className="text-xs text-zinc-400">{a.domain?.name ?? "未分类"} · {a.contentLength} 字 · {a.importSource}</p>
            </div>
          </label>
        ))}
      </div>

      {/* Generate form */}
      <div className="glass-card p-4">
        <h3 className="font-semibold text-zinc-900 mb-3">生成赛道提示词</h3>
        {jobId && (
          <div className="mb-4 rounded-2xl bg-blue-50/70 backdrop-blur px-4 py-3 text-sm text-blue-600">
            任务状态: {jobStatus === "completed" ? "已完成 ✅" : jobStatus === "failed" ? "失败 ❌" : jobStatus}
            {jobStatus === "completed" && <><br /><Link href="/prompts" className="text-teal-600 font-medium hover:underline">前往提示词库查看</Link></>}
          </div>
        )}
        {genError && <div className="mb-4 rounded-2xl bg-red-50/70 backdrop-blur px-4 py-3 text-sm text-red-600">{genError}</div>}
        {!jobId && (
          <form onSubmit={handleGenerate} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input value={gpName} onChange={e => setGpName(e.target.value)} placeholder="提示词名称" required className="glass-input text-sm" />
              <select value={gpGroupId} onChange={e => setGpGroupId(e.target.value)} className="glass-input text-sm">
                <option value="">无分组</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <input value={gpAudience} onChange={e => setGpAudience(e.target.value)} placeholder="目标读者" required className="glass-input text-sm" />
              <input value={gpPersona} onChange={e => setGpPersona(e.target.value)} placeholder="作者人设" required className="glass-input text-sm" />
            </div>
            <textarea value={gpNotes} onChange={e => setGpNotes(e.target.value)} placeholder="用户补充要求（可选）" className="glass-input w-full text-sm" rows={2} />
            <button type="submit" disabled={selected.length < 3} className="glass-btn-primary">生成赛道提示词</button>
          </form>
        )}
      </div>
    </div>
  );
}
