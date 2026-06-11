"use client";

import { useEffect, useState } from "react";
import { useModal } from "@/components/ui/modal";
import { formatPromptSource } from "@/lib/ui/labels";

type Group = { id: string; name: string };
type Prompt = {
  id: string;
  name: string;
  content: string;
  sourceType: string;
  groupId: string | null;
  group: Group | null;
  config: Record<string, unknown> | null;
  createdAt: string;
};

function getStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function getSourceMeta(prompt: Prompt) {
  const config = prompt.config ?? {};
  const articleIds = getStringArray(config.articleIds);
  const referenceUrls = getStringArray(config.referenceUrls);
  const sourceUrls = getStringArray(config.sourceUrls);
  const links = referenceUrls.length > 0 ? referenceUrls : sourceUrls;

  if (prompt.sourceType === "material_track_generated") {
    return {
      summary: articleIds.length > 0 ? `来自 ${articleIds.length} 篇爆文拆解` : "来自爆文拆解",
      links,
    };
  }
  if (links.length > 0) {
    return { summary: `包含 ${links.length} 条来源链接`, links };
  }
  return { summary: "", links };
}

export function PromptList({
  groupId,
  groups,
  refreshKey,
  onRefresh,
}: {
  groupId: string | null;
  groups: Group[];
  refreshKey: number;
  onRefresh: () => void;
}) {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [keyword, setKeyword] = useState("");
  const [editing, setEditing] = useState<Prompt | null>(null);
  const [draft, setDraft] = useState({ name: "", content: "", groupId: "" });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const modal = useModal();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (groupId) params.set("groupId", groupId);
        if (keyword) params.set("keyword", keyword);
        const res = await fetch(`/api/prompts?${params}`);
        const body = await res.json();
        if (cancelled) return;
        if (!body.success) {
          setError(body.error?.message ?? "提示词加载失败。");
          return;
        }
        setPrompts(body.data);
      } catch {
        if (!cancelled) setError("网络异常，提示词加载失败。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [groupId, keyword, refreshKey]);

  function startEdit(prompt: Prompt) {
    setEditing(prompt);
    setDraft({ name: prompt.name, content: prompt.content, groupId: prompt.groupId ?? "" });
  }

  async function handleCopy(content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setNotice("已复制提示词内容");
    } catch {
      setNotice("复制失败，请检查浏览器权限");
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/prompts/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          content: draft.content,
          groupId: draft.groupId || null,
          config: editing.config,
        }),
      });
      const body = await res.json();
      if (!body.success) {
        setNotice(body.error?.message ?? "提示词保存失败。");
        return;
      }
      setEditing(null);
      setNotice("提示词已更新");
      onRefresh();
    } catch {
      setNotice("网络异常，提示词保存失败。");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const confirmed = await modal.open({
      title: "删除提示词",
      message: "确定删除此提示词？删除后无法恢复。",
      confirmLabel: "删除",
      variant: "danger",
    });
    if (!confirmed) return;
    await fetch(`/api/prompts/${id}`, { method: "DELETE" });
    onRefresh();
  }

  return (
    <div>
      <div className="mb-4 space-y-3">
        <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜索提示词..." className="glass-input w-full text-sm" />
        {notice && <p className="text-xs text-zinc-500">{notice}</p>}
      </div>

      {loading && <p className="py-8 text-sm text-zinc-400">加载中...</p>}
      {error && <p className="py-8 text-sm text-red-500">{error}</p>}
      {!loading && !error && prompts.length === 0 && <p className="py-8 text-sm text-zinc-400">暂无提示词。可以先投喂爆文素材生成一个专属提示词。</p>}

      {!loading && !error && prompts.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {prompts.map((prompt) => {
            const meta = getSourceMeta(prompt);
            return (
              <div key={prompt.id} className="glass-tile p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-medium text-zinc-900">{prompt.name}</h3>
                      <span className={prompt.sourceType === "manual" ? "badge-muted" : "badge-info"}>{formatPromptSource(prompt.sourceType)}</span>
                    </div>
                    {prompt.group && <p className="mt-0.5 text-xs text-zinc-400">{prompt.group.name}</p>}
                    {meta.summary && <p className="mt-1 text-xs text-teal-600">{meta.summary}</p>}
                    {meta.links.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {meta.links.slice(0, 2).map((link) => (
                          <a key={link} href={link} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-zinc-400 hover:text-zinc-600">
                            {link}
                          </a>
                        ))}
                      </div>
                    )}
                    <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm text-zinc-600">{prompt.content}</p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 text-right">
                    <button onClick={() => startEdit(prompt)} className="text-xs text-zinc-400 hover:text-zinc-600">
                      编辑
                    </button>
                    <button onClick={() => handleCopy(prompt.content)} className="text-xs text-zinc-400 hover:text-zinc-600">
                      复制
                    </button>
                    <button onClick={() => handleDelete(prompt.id)} className="text-xs text-red-400 hover:text-red-600">
                      删除
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-sm" onClick={() => setEditing(null)}>
          <form className="glass-card mx-4 max-h-[80vh] w-full max-w-2xl overflow-y-auto p-6" onSubmit={handleSave} onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-semibold text-zinc-900">编辑提示词</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">名称</label>
                <input required value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} className="glass-input w-full text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">分组</label>
                <select value={draft.groupId} onChange={(e) => setDraft((d) => ({ ...d, groupId: e.target.value }))} className="glass-input w-full text-sm">
                  <option value="">无分组</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">内容</label>
                <textarea required value={draft.content} onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))} className="glass-input w-full text-sm" rows={12} />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="glass-btn-secondary">
                取消
              </button>
              <button type="submit" disabled={saving} className="glass-btn-primary">
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
