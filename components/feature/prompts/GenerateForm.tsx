"use client";

import { useState } from "react";

type Group = { id: string; name: string };

export function GenerateForm({ groups, onSuccess }: { groups: Group[]; onSuccess: () => void }) {
  const [form, setForm] = useState({
    name: "", contentDomain: "财经", targetAudience: "职场人士和理财人群", authorName: "财经观察者",
    personaDetails: "长期关注宏观经济和普通人理财", personalityTraits: "理性分析型,犀利直接型",
    headingStyle: "numbered", wordCount: 1800, enableAIDetectionEvasion: true, groupId: "",
  });
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const payload = { ...form, personalityTraits: form.personalityTraits.split(",").map(s => s.trim()).filter(Boolean), groupId: form.groupId || null, materialAnalysisJson: "{}", userNotes: "", materialType: "text", referenceUrls: [], materialText: "", wordCount: Number(form.wordCount), enableAIDetectionEvasion: Boolean(form.enableAIDetectionEvasion) };
      const res = await fetch("/api/prompts/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await res.json();
      if (!body.success) { setError(body.error?.message ?? "生成失败"); setLoading(false); return; }
      setJobId(body.data.jobId); setJobStatus(body.data.status);
      const poll = setInterval(async () => {
        const r = await fetch(`/api/prompts/generation-jobs/${body.data.jobId}`); const b = await r.json();
        if (!b.success) return; setJobStatus(b.data.status);
        if (b.data.status === "completed" || b.data.status === "failed") { clearInterval(poll); setLoading(false); onSuccess(); }
      }, 500);
    } catch { setError("网络错误"); setLoading(false); }
  }

  return (
    <div>
      <h3 className="font-semibold text-zinc-900 mb-4">生成提示词</h3>
      {error && <div className="mb-4 rounded-2xl bg-red-50/70 backdrop-blur px-4 py-3 text-sm text-red-600">{error}</div>}
      {jobId && <div className="mb-4 rounded-2xl bg-blue-50/70 backdrop-blur px-4 py-3 text-sm text-blue-600">任务状态: {jobStatus}</div>}
      {!jobId && (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium text-zinc-700 mb-1">提示词名称</label>
            <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full glass-input text-sm" placeholder="如：财经爆款提示词" /></div>
          <div><label className="block text-sm font-medium text-zinc-700 mb-1">内容领域</label>
            <input required value={form.contentDomain} onChange={e => setForm(f => ({ ...f, contentDomain: e.target.value }))} className="w-full glass-input text-sm" /></div>
          <div><label className="block text-sm font-medium text-zinc-700 mb-1">目标受众</label>
            <input value={form.targetAudience} onChange={e => setForm(f => ({ ...f, targetAudience: e.target.value }))} className="w-full glass-input text-sm" /></div>
          <div><label className="block text-sm font-medium text-zinc-700 mb-1">作者人设</label>
            <input value={form.authorName} onChange={e => setForm(f => ({ ...f, authorName: e.target.value }))} className="w-full glass-input text-sm" /></div>
          <div><label className="block text-sm font-medium text-zinc-700 mb-1">人设描述</label>
            <input value={form.personaDetails} onChange={e => setForm(f => ({ ...f, personaDetails: e.target.value }))} className="w-full glass-input text-sm" /></div>
          <div><label className="block text-sm font-medium text-zinc-700 mb-1">性格特征</label>
            <input value={form.personalityTraits} onChange={e => setForm(f => ({ ...f, personalityTraits: e.target.value }))} className="w-full glass-input text-sm" /></div>
          <div><label className="block text-sm font-medium text-zinc-700 mb-1">标题结构</label>
            <select value={form.headingStyle} onChange={e => setForm(f => ({ ...f, headingStyle: e.target.value }))} className="w-full glass-input text-sm">
              <option value="numbered">数字型</option><option value="question">疑问型</option><option value="contrast">对比型</option><option value="howto">方法论型</option></select></div>
          <div><label className="block text-sm font-medium text-zinc-700 mb-1">目标字数</label>
            <input type="number" value={form.wordCount} onChange={e => setForm(f => ({ ...f, wordCount: Number(e.target.value) }))} className="w-full glass-input text-sm" /></div>
          <div className="sm:col-span-2"><label className="block text-sm font-medium text-zinc-700 mb-1">所属分组</label>
            <select value={form.groupId} onChange={e => setForm(f => ({ ...f, groupId: e.target.value }))} className="w-full glass-input text-sm">
              <option value="">无分组</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
          <div className="sm:col-span-2 flex items-center gap-2">
            <input type="checkbox" id="antiAI" checked={form.enableAIDetectionEvasion} onChange={e => setForm(f => ({ ...f, enableAIDetectionEvasion: e.target.checked }))} className="rounded" />
            <label htmlFor="antiAI" className="text-sm text-zinc-600">降低 AI 痕迹</label></div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={loading} className="glass-btn-primary">{loading ? "生成中..." : "开始生成"}</button></div>
        </form>
      )}
    </div>
  );
}
