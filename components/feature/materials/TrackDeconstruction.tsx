"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useModal } from "@/components/ui/modal";
import { formatJobStatus } from "@/lib/ui/labels";

type Domain = { id: string; name: string };
type ImportedArticle = {
  id: string;
  title: string;
  domainId: string;
  domain: { name: string } | null;
  contentLength: number;
  importSource: string;
  createdAt: string;
};

function importSourceLabel(source: string) {
  if (source === "paste") return "粘贴导入";
  if (source === "url") return "链接抓取";
  if (source === "seed") return "系统素材";
  return source;
}

export function TrackDeconstruction() {
  const modal = useModal();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [articles, setArticles] = useState<ImportedArticle[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(false);
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteDomainId, setPasteDomainId] = useState("");
  const [pasteContent, setPasteContent] = useState("");
  const [pasteUrl, setPasteUrl] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [urlDomainId, setUrlDomainId] = useState("");
  const [filterDomain, setFilterDomain] = useState("");
  const [promptName, setPromptName] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [authorPersona, setAuthorPersona] = useState("");
  const [userNotes, setUserNotes] = useState("");
  const [promptGroupId, setPromptGroupId] = useState("");
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState("");
  const [generateError, setGenerateError] = useState("");

  const refreshArticles = useCallback(async () => {
    setLoadingArticles(true);
    try {
      const params = new URLSearchParams();
      if (filterDomain) params.set("domainId", filterDomain);
      params.set("pageSize", "50");
      const res = await fetch(`/api/material/imported-articles?${params}`);
      const body = await res.json();
      if (body.success) setArticles(body.data.items);
    } finally {
      setLoadingArticles(false);
    }
  }, [filterDomain]);

  useEffect(() => {
    fetch("/api/material/domains")
      .then((res) => res.json())
      .then((body) => {
        if (body.success) setDomains(body.data);
      })
      .catch(() => {});
    fetch("/api/prompts/groups")
      .then((res) => res.json())
      .then((body) => {
        if (body.success) setGroups(body.data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      refreshArticles();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshArticles]);

  async function handlePaste(e: React.FormEvent) {
    e.preventDefault();
    if (!pasteTitle || !pasteContent || !pasteDomainId) return;
    if (pasteContent.trim().length < 300) {
      await modal.open({ title: "导入失败", message: "正文内容太少，至少需要 300 字。" });
      return;
    }

    const res = await fetch("/api/material/articles/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "paste",
        title: pasteTitle,
        content: pasteContent,
        domainId: pasteDomainId,
        sourceUrl: pasteUrl || undefined,
      }),
    });
    const body = await res.json();
    if (body.success) {
      setPasteTitle("");
      setPasteContent("");
      setPasteUrl("");
      await refreshArticles();
    } else {
      await modal.open({ title: "导入失败", message: body.error?.message ?? "文章导入失败，请稍后重试。" });
    }
  }

  async function handleUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!urlInput || !urlDomainId) return;
    const res = await fetch("/api/material/articles/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "url", url: urlInput, domainId: urlDomainId }),
    });
    const body = await res.json();
    if (body.success) {
      setUrlInput("");
      await refreshArticles();
    } else {
      await modal.open({ title: "抓取失败", message: body.error?.message ?? "无法抓取文章全文，请尝试粘贴全文。" });
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 10) return prev;
      return [...prev, id];
    });
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenerateError("");
    setJobId(null);

    if (selected.length < 3) {
      setGenerateError("至少选择 3 篇文章，最多选择 10 篇文章。");
      return;
    }
    if (!promptName || !targetAudience || !authorPersona) {
      setGenerateError("请填写提示词名称、目标读者和作者人设。");
      return;
    }

    const domainId = filterDomain || articles.find((article) => selected.includes(article.id))?.domainId || "";
    const res = await fetch("/api/material/track-prompts/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        domainId,
        articleIds: selected,
        name: promptName,
        targetAudience,
        authorPersona,
        userNotes,
        groupId: promptGroupId || null,
      }),
    });
    const body = await res.json();
    if (!body.success) {
      setGenerateError(body.error?.message ?? "创建拆解任务失败。");
      return;
    }

    setJobId(body.data.jobId);
    setJobStatus(body.data.status);
    const poll = window.setInterval(async () => {
      const jobRes = await fetch(`/api/prompts/generation-jobs/${body.data.jobId}`);
      const jobBody = await jobRes.json();
      if (!jobBody.success) return;
      setJobStatus(jobBody.data.status);
      if (jobBody.data.status === "completed") {
        window.clearInterval(poll);
        setSelected([]);
      }
      if (jobBody.data.status === "failed") {
        window.clearInterval(poll);
        setGenerateError(jobBody.data.errorMessage ?? "生成失败，请稍后重试。");
      }
    }, 1000);
  }

  return (
    <div className="space-y-6">
      <div className="glass-panel p-5">
        <h2 className="text-lg font-semibold text-zinc-900">爆文拆解</h2>
        <p className="mt-1 text-sm text-zinc-500">
          导入爆款文章全文，选择 3-10 篇同赛道文章，AI 会拆解共性结构并生成私有提示词。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="glass-panel p-4">
          <h3 className="mb-3 font-semibold text-zinc-900">粘贴全文</h3>
          <form onSubmit={handlePaste} className="space-y-3">
            <input value={pasteTitle} onChange={(e) => setPasteTitle(e.target.value)} placeholder="文章标题" required className="glass-input w-full text-sm" />
            <select value={pasteDomainId} onChange={(e) => setPasteDomainId(e.target.value)} required className="glass-input w-full text-sm">
              <option value="">选择赛道</option>
              {domains.map((domain) => (
                <option key={domain.id} value={domain.id}>
                  {domain.name}
                </option>
              ))}
            </select>
            <textarea
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
              placeholder="粘贴完整正文，至少 300 字..."
              required
              className="glass-input h-32 w-full resize-y text-sm"
            />
            <p className={`text-xs ${pasteContent.length > 0 && pasteContent.trim().length < 300 ? "text-amber-600" : "text-zinc-400"}`}>
              当前 {pasteContent.trim().length} 字，生成前需至少 300 字。
            </p>
            <input value={pasteUrl} onChange={(e) => setPasteUrl(e.target.value)} placeholder="来源链接（可选）" className="glass-input w-full text-sm" />
            <button type="submit" className="glass-btn-primary w-full !py-1.5 !text-sm">
              保存文章
            </button>
          </form>
        </div>

        <div className="glass-panel p-4">
          <h3 className="mb-3 font-semibold text-zinc-900">文章 URL 抓取</h3>
          <form onSubmit={handleUrl} className="space-y-3">
            <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="文章 URL" required className="glass-input w-full text-sm" />
            <select value={urlDomainId} onChange={(e) => setUrlDomainId(e.target.value)} required className="glass-input w-full text-sm">
              <option value="">选择赛道</option>
              {domains.map((domain) => (
                <option key={domain.id} value={domain.id}>
                  {domain.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-zinc-400">抓取后仍会校验全文长度，少于 300 字请改用粘贴全文。</p>
            <button type="submit" className="glass-btn-primary w-full !py-1.5 !text-sm">
              抓取并保存
            </button>
          </form>
        </div>

        <div className="glass-panel p-4">
          <h3 className="mb-3 font-semibold text-zinc-900">第三方 API 导入</h3>
          <p className="text-sm text-zinc-500">接口预留，暂未配置。</p>
          <button disabled className="glass-btn-secondary mt-4 w-full !py-1.5 !text-sm opacity-50">
            暂不可用
          </button>
        </div>
      </div>

      <div className="glass-card p-4">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-zinc-900">已导入文章</h3>
            <p className="text-xs text-zinc-400">勾选 3-10 篇文章用于生成提示词。</p>
          </div>
          <select value={filterDomain} onChange={(e) => setFilterDomain(e.target.value)} className="glass-input text-sm !py-1">
            <option value="">全部赛道</option>
            {domains.map((domain) => (
              <option key={domain.id} value={domain.id}>
                {domain.name}
              </option>
            ))}
          </select>
        </div>
        <p className="mb-2 text-xs text-zinc-500">
          已选择 {selected.length}/10 篇{selected.length < 3 ? "，至少选择 3 篇" : ""}
        </p>
        {loadingArticles && <p className="text-sm text-zinc-400">加载中...</p>}
        {!loadingArticles && articles.length === 0 && <p className="text-sm text-zinc-400">暂无导入文章。请先粘贴全文或抓取链接。</p>}
        {articles.map((article) => (
          <label key={article.id} className="flex cursor-pointer items-center gap-3 border-b border-black/5 py-2 last:border-0 hover:bg-white/30">
            <input type="checkbox" checked={selected.includes(article.id)} onChange={() => toggleSelect(article.id)} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-zinc-800">{article.title}</p>
              <p className="text-xs text-zinc-400">
                {article.domain?.name ?? "未分类"} · {article.contentLength} 字 · {importSourceLabel(article.importSource)}
              </p>
            </div>
          </label>
        ))}
      </div>

      <div className="glass-card p-4">
        <h3 className="mb-3 font-semibold text-zinc-900">生成赛道提示词</h3>
        {jobId && (
          <div className="mb-4 rounded-2xl bg-blue-50/70 px-4 py-3 text-sm text-blue-600 backdrop-blur">
            任务状态：{formatJobStatus(jobStatus)}
            {jobStatus === "completed" && (
              <>
                <br />
                <Link href="/prompts" className="font-medium text-teal-600 hover:underline">
                  前往提示词库查看
                </Link>
              </>
            )}
          </div>
        )}
        {generateError && <div className="mb-4 rounded-2xl bg-red-50/70 px-4 py-3 text-sm text-red-600 backdrop-blur">{generateError}</div>}
        {!jobId && (
          <form onSubmit={handleGenerate} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input value={promptName} onChange={(e) => setPromptName(e.target.value)} placeholder="提示词名称" required className="glass-input text-sm" />
              <select value={promptGroupId} onChange={(e) => setPromptGroupId(e.target.value)} className="glass-input text-sm">
                <option value="">无分组</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
              <input value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} placeholder="目标读者" required className="glass-input text-sm" />
              <input value={authorPersona} onChange={(e) => setAuthorPersona(e.target.value)} placeholder="作者人设" required className="glass-input text-sm" />
            </div>
            <textarea value={userNotes} onChange={(e) => setUserNotes(e.target.value)} placeholder="补充要求（可选）" className="glass-input w-full text-sm" rows={2} />
            <button type="submit" disabled={selected.length < 3} className="glass-btn-primary disabled:opacity-50">
              生成赛道提示词
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
