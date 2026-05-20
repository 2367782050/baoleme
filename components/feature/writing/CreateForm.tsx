"use client";

import { useState, useEffect } from "react";

type Group = { id: string; name: string };
type Prompt = { id: string; name: string };

export function CreateForm({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState({ title: "", promptId: "", groupId: "", sourceUrl: "", referenceUrls: "", materialText: "", imageCount: 0, imageStrategy: "none", needMaterial: true });
  const [groups, setGroups] = useState<Group[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/article/groups", { credentials: "include" }).then(r => r.json()).then(b => { if (b.success) setGroups(b.data); });
    fetch("/api/prompts", { credentials: "include" }).then(r => r.json()).then(b => { if (b.success) setPrompts(b.data); });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const payload = { ...form, referenceUrls: form.referenceUrls.split("\n").filter(Boolean), needMaterial: Boolean(form.needMaterial) };
      const r = await fetch("/api/articles/generate", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const b = await r.json();
      if (!b.success) { setError(b.error?.message ?? "失败"); setLoading(false); return; }
      setJobId(b.data.jobId); setStatus(b.data.status);
      const poll = setInterval(async () => {
        const r2 = await fetch(`/api/articles/jobs/${b.data.jobId}`, { credentials: "include" }); const b2 = await r2.json();
        if (!b2.success) return; setStatus(b2.data.status);
        if (b2.data.status === "completed" || b2.data.status === "failed") { clearInterval(poll); setLoading(false); onSuccess(); }
      }, 800);
    } catch { setError("网络错误"); setLoading(false); }
  }

  return (
    <div>
      <h3 className="font-semibold text-zinc-900 mb-4">新建创作</h3>
      {error && <div className="mb-4 rounded-2xl bg-red-50/70 backdrop-blur px-4 py-3 text-sm text-red-600">{error}</div>}
      {jobId && <div className="mb-4 rounded-2xl bg-blue-50/70 backdrop-blur px-4 py-3 text-sm text-blue-600">任务状态: {status}</div>}
      {!jobId && (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><label className="block text-sm font-medium text-zinc-700 mb-1">创作主题</label>
            <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full glass-input text-sm" placeholder="输入您想创作的主题..." /></div>
          <div><label className="block text-sm font-medium text-zinc-700 mb-1">分组</label>
            <select value={form.groupId} onChange={e => setForm(f => ({ ...f, groupId: e.target.value }))} className="w-full glass-input text-sm">
              <option value="">无分组</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
          <div><label className="block text-sm font-medium text-zinc-700 mb-1">提示词</label>
            <select value={form.promptId} onChange={e => setForm(f => ({ ...f, promptId: e.target.value }))} className="w-full glass-input text-sm">
              <option value="">无提示词</option>{prompts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div><label className="block text-sm font-medium text-zinc-700 mb-1">来源 URL</label>
            <input value={form.sourceUrl} onChange={e => setForm(f => ({ ...f, sourceUrl: e.target.value }))} className="w-full glass-input text-sm" /></div>
          <div><label className="block text-sm font-medium text-zinc-700 mb-1">参考 URL（每行一个）</label>
            <textarea value={form.referenceUrls} onChange={e => setForm(f => ({ ...f, referenceUrls: e.target.value }))} className="w-full glass-input text-sm" rows={2} /></div>
          <div className="sm:col-span-2"><label className="block text-sm font-medium text-zinc-700 mb-1">文本素材</label>
            <textarea value={form.materialText} onChange={e => setForm(f => ({ ...f, materialText: e.target.value }))} className="w-full glass-input text-sm" rows={3} placeholder="粘贴或输入参考文本素材..." /></div>
          <div><label className="block text-sm font-medium text-zinc-700 mb-1">图片数量</label>
            <input type="number" value={form.imageCount} onChange={e => setForm(f => ({ ...f, imageCount: Number(e.target.value) }))} className="w-full glass-input text-sm" /></div>
          <div><label className="block text-sm font-medium text-zinc-700 mb-1">图片策略</label>
            <select value={form.imageStrategy} onChange={e => setForm(f => ({ ...f, imageStrategy: e.target.value }))} className="w-full glass-input text-sm">
              <option value="none">不使用</option><option value="relevant_collection">相关配图</option></select></div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={loading} className="glass-btn-primary">{loading ? "提交中..." : "开始创作"}</button></div>
        </form>
      )}
    </div>
  );
}
