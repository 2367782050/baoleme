"use client";

import { useState, useEffect } from "react";

type Group = { id: string; name: string };
type Prompt = { id: string; name: string; content: string; sourceType: string; groupId: string | null; group: Group | null; config: Record<string, unknown> | null; createdAt: string; };

export function PromptList({ groupId, refreshKey, onRefresh }: { groupId: string | null; groups: Group[]; refreshKey: number; onRefresh: () => void }) {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [keyword, setKeyword] = useState("");
  const [editing, setEditing] = useState<Prompt | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true); setError("");
      try {
        const params = new URLSearchParams();
        if (groupId) params.set("groupId", groupId);
        if (keyword) params.set("keyword", keyword);
        const res = await fetch(`/api/prompts?${params}`); const body = await res.json();
        if (!body.success) { setError(body.error?.message ?? "加载失败"); return; }
        setPrompts(body.data);
      } catch { setError("网络错误"); }
      finally { setLoading(false); }
    }
    load();
  }, [groupId, keyword, refreshKey]);

  async function handleDelete(id: string) {
    if (!confirm("确定删除此提示词？")) return;
    await fetch(`/api/prompts/${id}`, { method: "DELETE" }); onRefresh();
  }

  return (
    <div>
      <div className="mb-4">
        <input type="text" value={keyword} onChange={e => setKeyword(e.target.value)}
          placeholder="搜索提示词..." className="glass-input text-sm w-full" />
      </div>

      {loading && <p className="text-sm text-zinc-400 py-8">加载中...</p>}
      {error && <p className="text-sm text-red-500 py-8">{error}</p>}
      {!loading && !error && prompts.length === 0 && (
        <p className="text-sm text-zinc-400 py-8">暂无提示词。点击「生成提示词」创建第一个。</p>
      )}

      {!loading && !error && prompts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {prompts.map(p => (
            <div key={p.id} className="glass-tile p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-zinc-900 truncate">{p.name}</h3>
                    <span className={p.sourceType === "generated" ? "badge-info" : "badge-muted"}>
                      {p.sourceType === "generated" ? "AI生成" : "手动"}
                    </span>
                  </div>
                  {p.group && <p className="text-xs text-zinc-400 mt-0.5">{p.group.name}</p>}
                  <p className="mt-2 text-sm text-zinc-600 line-clamp-2 whitespace-pre-wrap">{p.content}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setEditing(p)} className="text-xs text-zinc-400 hover:text-zinc-600">查看</button>
                  <button onClick={() => handleDelete(p.id)} className="text-xs text-red-400 hover:text-red-600">删除</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-sm" onClick={() => setEditing(null)}>
          <div className="glass-card p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-zinc-900 text-lg mb-2">{editing.name}</h3>
            {editing.group && <p className="text-xs text-zinc-400 mb-4">分组: {editing.group.name}</p>}
            <pre className="whitespace-pre-wrap text-sm text-zinc-700 bg-zinc-50/80 rounded-2xl p-4 max-h-96 overflow-y-auto">{editing.content}</pre>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setEditing(null)} className="glass-btn-secondary">关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
