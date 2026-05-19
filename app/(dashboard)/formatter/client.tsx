"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { MarkdownEditor } from "@/components/feature/formatter/MarkdownEditor";
import { PreviewPane } from "@/components/feature/formatter/PreviewPane";
import { StylePanel } from "@/components/feature/formatter/StylePanel";
import { DEFAULT_CONFIG } from "@/lib/services/formatter.service";
import type { FormatterConfig } from "@/lib/services/formatter.service";

export function FormatterClient() {
  const searchParams = useSearchParams();
  const articleId = searchParams.get("articleId");
  const [config, setConfig] = useState<FormatterConfig>(DEFAULT_CONFIG);
  const [markdown, setMarkdown] = useState("");
  const [title, setTitle] = useState("");
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  // Load article content when articleId changes
  useEffect(() => {
    if (!articleId) return;
    let cancelled = false;
    async function load(id: string) {
      setLoading(true);
      setError("");
      try {
        const r = await fetch(`/api/articles/${id}`);
        const b = await r.json();
        if (cancelled) return;
        if (!b.success) { setError("文章加载失败"); return; }
        const a = b.data;
        setTitle(a.title ?? "");
        setMarkdown(a.markdownContent ?? "");
        if (a.formatterConfig) {
          const fc = a.formatterConfig as Partial<FormatterConfig>;
          setConfig({ ...DEFAULT_CONFIG, ...fc });
        }
        if (a.htmlContent) setHtml(a.htmlContent);
      } catch {
        if (!cancelled) setError("网络错误");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load(articleId);
    return () => { cancelled = true; };
  }, [articleId]);

  async function handleRender() {
    setError("");
    try {
      const r = await fetch("/api/formatter/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown, ...config }),
      });
      const b = await r.json();
      if (!b.success) { setError(b.error?.message ?? "渲染失败"); return; }
      setHtml(b.data.html);
    } catch { setError("网络错误"); }
  }

  async function handleSave() {
    if (!articleId) { setError("没有文章 ID，无法保存"); return; }
    setSaving(true);
    setError("");
    try {
      const r = await fetch(`/api/articles/${articleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, markdownContent: markdown, htmlContent: html, formatterConfig: config }),
      });
      const b = await r.json();
      if (!b.success) { setError(b.error?.message ?? "保存失败"); return; }
    } catch { setError("网络错误"); }
    finally { setSaving(false); }
  }

  async function handleCopy() {
    try { await navigator.clipboard.writeText(html); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setError("复制失败，请手动复制 HTML"); }
  }

  if (loading) return <div className="mx-auto max-w-6xl px-6 py-12 text-sm text-zinc-400">加载中...</div>;

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 pb-4 border-b border-zinc-200">
        <h1 className="text-lg font-bold text-zinc-900 mr-4">一键排版</h1>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="文章标题" className="text-sm border border-zinc-300 rounded-lg px-3 py-1.5 w-48" />
        <button onClick={handleRender} className="rounded-lg bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800">预览</button>
        <button onClick={handleSave} disabled={saving || !articleId} className="rounded-lg border border-zinc-300 px-4 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-50">
          {saving ? "保存中..." : "保存"}
        </button>
        <button onClick={handleCopy} className="rounded-lg border border-zinc-300 px-4 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50">
          {copied ? "已复制!" : "复制 HTML"}
        </button>
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>

      {/* Main area */}
      <div className="flex flex-col lg:flex-row gap-6 mt-6">
        <div className="lg:w-56 shrink-0">
          <StylePanel config={config} onChange={setConfig} />
        </div>
        <div className="flex-1 min-w-0">
          <MarkdownEditor value={markdown} onChange={setMarkdown} />
        </div>
        <div className="flex-1 min-w-0 lg:max-w-[400px]">
          <PreviewPane html={html} />
        </div>
      </div>
    </div>
  );
}
