"use client";

import { useEffect, useMemo, useState } from "react";
import { formatJobStatus } from "@/lib/ui/labels";

type Group = { id: string; name: string };
type Prompt = {
  id: string;
  name: string;
  sourceType?: string | null;
  config?: unknown;
};

const IMAGE_MODES = [
  { value: "smart", label: "智能配图", imageCount: 3 },
  { value: "source_collect", label: "原文采集", imageCount: 3 },
  { value: "none", label: "不插图", imageCount: 0 },
] as const;

const WRITING_MODES = [
  {
    value: "quick",
    label: "快速成稿",
    description: "适合先拿一版草稿，后续再人工精修。",
  },
  {
    value: "material_based",
    label: "素材成稿",
    description: "适合已有资料、采访记录或文章链接。",
  },
  {
    value: "viral_deep",
    label: "爆文深度成稿",
    description: "推荐。先借鉴爆文结构，再生成并做人味改写。",
  },
  {
    value: "humanized",
    label: "人味强化成稿",
    description: "更重视具体细节、观点边界和自然表达。",
  },
] as const;

type WritingMode = (typeof WRITING_MODES)[number]["value"];

function selectedPromptUsesMaterials(prompt?: Prompt) {
  if (!prompt) return false;
  if (prompt.sourceType === "material_track_generated") return true;
  const configText = JSON.stringify(prompt.config ?? {});
  return configText.includes("material") || configText.includes("track");
}

export function CreateForm({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState({
    title: "",
    promptId: "",
    groupId: "",
    sourceUrl: "",
    referenceUrls: "",
    materialText: "",
    writingMode: "viral_deep" as WritingMode,
    targetAudience: "",
    corePoint: "",
    personalExperience: "",
    forbiddenExpressions: "",
    expectedTone: "",
    contentDomain: "",
    imageMode: "none",
    needMaterial: true,
  });
  const [groups, setGroups] = useState<Group[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const selectedPrompt = useMemo(
    () => prompts.find((prompt) => prompt.id === form.promptId),
    [form.promptId, prompts],
  );
  const isMaterialPrompt = selectedPromptUsesMaterials(selectedPrompt);

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
        if (body.success) setPrompts(body.data.items ?? body.data);
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
        writingMode: form.writingMode,
        targetAudience: form.targetAudience,
        corePoint: form.corePoint,
        personalExperience: form.personalExperience,
        forbiddenExpressions: form.forbiddenExpressions,
        expectedTone: form.expectedTone,
        contentDomain: form.contentDomain,
        promptContextSummary: selectedPrompt?.config ?? null,
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
      <p className="mb-4 text-sm text-zinc-500">
        想让文章更像真人表达，请尽量提供真实案例、个人经历、观察细节或业务素材。系统会帮助提升文章质量，但不承诺任何检测结果。
      </p>
      {error && <div className="mb-4 rounded-2xl bg-red-50/70 px-4 py-3 text-sm text-red-600 backdrop-blur">{error}</div>}
      {jobId && <div className="mb-4 rounded-2xl bg-blue-50/70 px-4 py-3 text-sm text-blue-600 backdrop-blur">任务状态：{formatJobStatus(status)}</div>}
      {!jobId && (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium text-zinc-700">写作模式</label>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              {WRITING_MODES.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, writingMode: mode.value }))}
                  className={`rounded-3xl border p-4 text-left transition ${
                    form.writingMode === mode.value
                      ? "border-teal-300 bg-white/80 shadow-[0_18px_45px_rgba(20,184,166,0.18)]"
                      : "border-white/60 bg-white/45 hover:border-teal-200 hover:bg-white/70"
                  }`}
                >
                  <span className="block text-sm font-semibold text-zinc-900">{mode.label}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-zinc-500">{mode.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-zinc-700">文章标题或选题</label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="glass-input w-full text-sm"
              placeholder="输入文章标题或选题方向"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">内容赛道</label>
            <input
              value={form.contentDomain}
              onChange={(e) => setForm((f) => ({ ...f, contentDomain: e.target.value }))}
              className="glass-input w-full text-sm"
              placeholder="例如 财经理财 / 职场成长"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">目标读者</label>
            <input
              required
              value={form.targetAudience}
              onChange={(e) => setForm((f) => ({ ...f, targetAudience: e.target.value }))}
              className="glass-input w-full text-sm"
              placeholder="例如 25-35 岁职场人"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-zinc-700">核心观点</label>
            <textarea
              required
              value={form.corePoint}
              onChange={(e) => setForm((f) => ({ ...f, corePoint: e.target.value }))}
              className="glass-input w-full text-sm"
              rows={2}
              placeholder="这篇文章最想表达的判断，不要只写主题。"
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
            {isMaterialPrompt && (
              <p className="mt-2 rounded-2xl bg-teal-50/70 px-3 py-2 text-xs leading-relaxed text-teal-700">
                当前提示词来自爆文拆解，建议搭配素材正文使用，不建议照搬原文表达。
              </p>
            )}
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
              placeholder="粘贴爆文片段、采访素材、业务资料或选题说明。"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-zinc-700">真实案例 / 个人经历</label>
            <textarea
              value={form.personalExperience}
              onChange={(e) => setForm((f) => ({ ...f, personalExperience: e.target.value }))}
              className="glass-input w-full text-sm"
              rows={3}
              placeholder="可写真实观察、业务案例、读者故事、踩坑经历。不要编造。"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">期望语气</label>
            <input
              value={form.expectedTone}
              onChange={(e) => setForm((f) => ({ ...f, expectedTone: e.target.value }))}
              className="glass-input w-full text-sm"
              placeholder="例如 克制、犀利、像朋友聊天"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">禁止表达</label>
            <input
              value={form.forbiddenExpressions}
              onChange={(e) => setForm((f) => ({ ...f, forbiddenExpressions: e.target.value }))}
              className="glass-input w-full text-sm"
              placeholder="例如 首先其次最后、综上所述"
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
