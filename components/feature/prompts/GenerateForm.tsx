"use client";

import { useState } from "react";
import { formatJobStatus } from "@/lib/ui/labels";

type Group = { id: string; name: string };

export function GenerateForm({ groups, onSuccess }: { groups: Group[]; onSuccess: () => void }) {
  const [form, setForm] = useState({
    name: "",
    contentDomain: "财经",
    targetAudience: "职场人士和理财人群",
    authorName: "财经观察者",
    personaDetails: "长期关注宏观经济和普通人理财",
    personalityTraits: "理性分析型, 犀利直接型",
    headingStyle: "numbered",
    wordCount: 1800,
    enableAIDetectionEvasion: true,
    groupId: "",
    materialText: "",
    referenceUrls: "",
    userNotes: "",
  });
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const referenceUrls = form.referenceUrls
        .split("\n")
        .map((url) => url.trim())
        .filter(Boolean);
      const payload = {
        ...form,
        personalityTraits: form.personalityTraits
          .split(",")
          .map((trait) => trait.trim())
          .filter(Boolean),
        groupId: form.groupId || null,
        materialAnalysisJson: "{}",
        materialType: form.materialText ? "article" : "text",
        referenceUrls,
        wordCount: Number(form.wordCount),
        enableAIDetectionEvasion: Boolean(form.enableAIDetectionEvasion),
      };
      const res = await fetch("/api/prompts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "提示词生成任务创建失败。");
        setLoading(false);
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
          setLoading(false);
          onSuccess();
        }
        if (jobBody.data.status === "failed") {
          window.clearInterval(poll);
          setLoading(false);
          setError(jobBody.data.errorMessage ?? "提示词生成失败，请检查素材后重试。");
        }
      }, 500);
    } catch {
      setError("网络异常，提示词生成任务提交失败。");
      setLoading(false);
    }
  }

  return (
    <div>
      <h3 className="mb-1 font-semibold text-zinc-900">投喂爆文素材生成专属提示词</h3>
      <p className="mb-4 text-sm text-zinc-500">粘贴爆文全文或来源链接，补充目标读者和作者人设，生成可复用的私有提示词。</p>
      {error && <div className="mb-4 rounded-2xl bg-red-50/70 px-4 py-3 text-sm text-red-600 backdrop-blur">{error}</div>}
      {jobId && <div className="mb-4 rounded-2xl bg-blue-50/70 px-4 py-3 text-sm text-blue-600 backdrop-blur">任务状态：{formatJobStatus(jobStatus)}</div>}
      {!jobId && (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">提示词名称</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="glass-input w-full text-sm"
              placeholder="如：财经爆款拆解提示词"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">内容赛道</label>
            <input required value={form.contentDomain} onChange={(e) => setForm((f) => ({ ...f, contentDomain: e.target.value }))} className="glass-input w-full text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">目标读者</label>
            <input value={form.targetAudience} onChange={(e) => setForm((f) => ({ ...f, targetAudience: e.target.value }))} className="glass-input w-full text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">作者人设</label>
            <input value={form.authorName} onChange={(e) => setForm((f) => ({ ...f, authorName: e.target.value }))} className="glass-input w-full text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">人设描述</label>
            <input value={form.personaDetails} onChange={(e) => setForm((f) => ({ ...f, personaDetails: e.target.value }))} className="glass-input w-full text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">性格特征</label>
            <input value={form.personalityTraits} onChange={(e) => setForm((f) => ({ ...f, personalityTraits: e.target.value }))} className="glass-input w-full text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">标题结构</label>
            <select value={form.headingStyle} onChange={(e) => setForm((f) => ({ ...f, headingStyle: e.target.value }))} className="glass-input w-full text-sm">
              <option value="numbered">数字型</option>
              <option value="question">提问型</option>
              <option value="contrast">对比型</option>
              <option value="howto">方法论型</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">目标字数</label>
            <input type="number" value={form.wordCount} onChange={(e) => setForm((f) => ({ ...f, wordCount: Number(e.target.value) }))} className="glass-input w-full text-sm" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-zinc-700">爆文素材全文</label>
            <textarea
              value={form.materialText}
              onChange={(e) => setForm((f) => ({ ...f, materialText: e.target.value }))}
              className="glass-input w-full text-sm"
              rows={5}
              placeholder="粘贴 1 篇或多篇爆文素材，系统会从素材中提炼标题、结构和表达规则。"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-zinc-700">来源链接</label>
            <textarea
              value={form.referenceUrls}
              onChange={(e) => setForm((f) => ({ ...f, referenceUrls: e.target.value }))}
              className="glass-input w-full text-sm"
              rows={2}
              placeholder="每行一个爆文链接，可选。"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-zinc-700">补充要求</label>
            <textarea value={form.userNotes} onChange={(e) => setForm((f) => ({ ...f, userNotes: e.target.value }))} className="glass-input w-full text-sm" rows={2} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-zinc-700">所属分组</label>
            <select value={form.groupId} onChange={(e) => setForm((f) => ({ ...f, groupId: e.target.value }))} className="glass-input w-full text-sm">
              <option value="">无分组</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              id="antiAI"
              checked={form.enableAIDetectionEvasion}
              onChange={(e) => setForm((f) => ({ ...f, enableAIDetectionEvasion: e.target.checked }))}
              className="rounded"
            />
            <label htmlFor="antiAI" className="text-sm text-zinc-600">
              减少模板化表达，提升自然度
            </label>
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={loading} className="glass-btn-primary">
              {loading ? "生成中..." : "生成专属提示词"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
