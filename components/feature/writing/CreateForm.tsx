"use client";

import { useEffect, useState } from "react";
import { formatJobStatus } from "@/lib/ui/labels";

type Group = { id: string; name: string };
type Prompt = { id: string; name: string };

const IMAGE_MODES = [
  { value: "smart", label: "智能配图", imageCount: 3 },
  { value: "source_collect", label: "原文采集", imageCount: 3 },
  { value: "none", label: "不插图", imageCount: 0 },
] as const;

export function CreateForm({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState({
    title: "",
    promptId: "",
    groupId: "",
    sourceUrl: "",
    referenceUrls: "",
    materialText: "",
    imageMode: "none",
    needMaterial: true,
  });
  const [groups, setGroups] = useState<Group[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/article/groups", { credentials: "include" })
      .then((res) => res.json())
      .then((body) => {
        if (body.success) setGroups(body.data);
      })
      .catch(() => {});
    fetch("/api/prompts", { credentials: "include" })
      .then((res) => res.json())
      .then((body) => {
        if (body.success) setPrompts(body.data);
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const imageMode = IMAGE_MODES.find((mode) => mode.value === form.imageMode) ?? IMAGE_MODES[2];
      const payload = {
        title: form.title,
        promptId: form.promptId,
        groupId: form.groupId,
        sourceUrl: form.sourceUrl,
        referenceUrls: form.referenceUrls
          .split("\n")
          .map((url) => url.trim())
          .filter(Boolean),
        materialText: form.materialText,
        imageCount: imageMode.imageCount,
        imageStrategy: imageMode.value,
        needMaterial: Boolean(form.needMaterial),
      };
      const res = await fetch("/api/articles/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "文章生产任务创建失败。");
        setLoading(false);
        return;
      }
      setJobId(body.data.jobId);
      setStatus(body.data.status);
      const poll = window.setInterval(async () => {
        const jobRes = await fetch(`/api/articles/jobs/${body.data.jobId}`, { credentials: "include" });
        const jobBody = await jobRes.json();
        if (!jobBody.success) return;
        setStatus(jobBody.data.status);
        if (jobBody.data.status === "completed") {
          window.clearInterval(poll);
          setLoading(false);
          onSuccess();
        }
        if (jobBody.data.status === "failed") {
          window.clearInterval(poll);
          setLoading(false);
          setError(jobBody.data.errorMessage ?? "文章生成失败，请检查提示词和素材后重试。");
        }
      }, 800);
    } catch {
      setError("网络异常，文章生产任务提交失败。");
      setLoading(false);
    }
  }

  return (
    <div>
      <h3 className="mb-1 font-semibold text-zinc-900">新建文章生产任务</h3>
      <p className="mb-4 text-sm text-zinc-500">选择提示词，补充素材链接和图片模式，生成后的文章会进入下方列表。</p>
      {error && <div className="mb-4 rounded-2xl bg-red-50/70 px-4 py-3 text-sm text-red-600 backdrop-blur">{error}</div>}
      {jobId && <div className="mb-4 rounded-2xl bg-blue-50/70 px-4 py-3 text-sm text-blue-600 backdrop-blur">任务状态：{formatJobStatus(status)}</div>}
      {!jobId && (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-zinc-700">文章标题</label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="glass-input w-full text-sm"
              placeholder="输入文章标题或选题方向"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">分组</label>
            <select value={form.groupId} onChange={(e) => setForm((f) => ({ ...f, groupId: e.target.value }))} className="glass-input w-full text-sm">
              <option value="">无分组</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">提示词</label>
            <select value={form.promptId} onChange={(e) => setForm((f) => ({ ...f, promptId: e.target.value }))} className="glass-input w-full text-sm">
              <option value="">无提示词</option>
              {prompts.map((prompt) => (
                <option key={prompt.id} value={prompt.id}>
                  {prompt.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">主来源链接</label>
            <input value={form.sourceUrl} onChange={(e) => setForm((f) => ({ ...f, sourceUrl: e.target.value }))} className="glass-input w-full text-sm" placeholder="可选" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">图片模式</label>
            <select value={form.imageMode} onChange={(e) => setForm((f) => ({ ...f, imageMode: e.target.value }))} className="glass-input w-full text-sm">
              {IMAGE_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-zinc-700">素材链接</label>
            <textarea
              value={form.referenceUrls}
              onChange={(e) => setForm((f) => ({ ...f, referenceUrls: e.target.value }))}
              className="glass-input w-full text-sm"
              rows={2}
              placeholder="每行一个参考链接，可选。"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-zinc-700">素材正文</label>
            <textarea
              value={form.materialText}
              onChange={(e) => setForm((f) => ({ ...f, materialText: e.target.value }))}
              className="glass-input w-full text-sm"
              rows={4}
              placeholder="粘贴爆文片段、采访素材或选题说明。"
            />
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              id="needMaterial"
              checked={form.needMaterial}
              onChange={(e) => setForm((f) => ({ ...f, needMaterial: e.target.checked }))}
              className="rounded"
            />
            <label htmlFor="needMaterial" className="text-sm text-zinc-600">
              生成时结合素材分析
            </label>
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={loading} className="glass-btn-primary">
              {loading ? "提交中..." : "开始生产文章"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
