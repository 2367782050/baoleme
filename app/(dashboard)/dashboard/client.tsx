"use client";

import Link from "next/link";
import Image from "next/image";
import { formatQuotaKey } from "@/lib/ui/labels";

type DashboardData = {
  user: { username: string; email: string; role: string };
  membership: { planName: string; planCode: string; status: string; expiresAt: string } | null;
  quota: Record<string, { used: number; limit: number; remaining: number }>;
};

const TOOLS = [
  { icon: "/ui-assets/tool-ai-writing.png", label: "智能创作", desc: "AI 生成高质量文章", href: "/writing" },
  { icon: "/ui-assets/tool-viral-topic.png", label: "爆款选题", desc: "发现全网热门内容", href: "/materials" },
  { icon: "/ui-assets/tool-rewrite.png", label: "文章改写", desc: "基于素材重新创作", href: "/writing" },
  { icon: "/ui-assets/tool-title.png", label: "标题生成", desc: "AI 生成爆款标题", href: "/prompts" },
  { icon: "/ui-assets/tool-material-search.png", label: "素材搜索", desc: "搜索全网创作素材", href: "/materials" },
  { icon: "/ui-assets/tool-image-tool.png", label: "图片工具", desc: "配图与封面生成", href: "/formatter" },
  { icon: "/ui-assets/tool-hot-trend.png", label: "热点追踪", desc: "实时热点话题监控", href: "/materials" },
  { icon: "/ui-assets/tool-template.png", label: "创作模板", desc: "高分提示词模板库", href: "/prompts" },
];

const FLOW_STEPS = [
  { icon: "/ui-assets/tool-viral-topic.png", label: "素材" },
  { icon: "/ui-assets/tool-template.png", label: "提示词" },
  { icon: "/ui-assets/tool-ai-writing.png", label: "文章" },
  { icon: "/ui-assets/tool-image-tool.png", label: "排版" },
];

export function DashboardClient({ data }: { data: DashboardData }) {
  return (
    <div className="glass-page pt-6 pb-20 px-6">
      <div className="mx-auto max-w-6xl">
        {/* Welcome — compact */}
        <div className="mb-6">
          <p className="text-xs text-zinc-400">你好，{data.user.username}</p>
        </div>

        {/* Hero card — creative progress preview */}
        <div className="glass-card p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left: today's inspiration */}
            <div className="flex-1">
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">今日灵感</p>
              <div className="space-y-2">
                {["2026下半年投资策略：防御性配置思路", "AI 概念股还能涨多久？", "创业3年，我学到的5条管理铁律"].map((t, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm text-zinc-700">
                    <span className="w-5 h-5 rounded-full bg-gradient-to-br from-sky-400/20 to-teal-400/20 flex items-center justify-center text-xs font-medium text-teal-600 shrink-0">{i + 1}</span>
                    <span className="truncate">{t}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Center: flow */}
            <div className="flex-1">
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">创作流程</p>
              <div className="flex items-center gap-2">
                {FLOW_STEPS.map((step, i) => (
                  <div key={step.label} className="flex items-center gap-2">
                    <div className="flex flex-col items-center gap-1">
                      <Image src={step.icon} alt={step.label} width={36} height={36} className="shrink-0" />
                      <span className="text-[10px] text-zinc-400">{step.label}</span>
                    </div>
                    {i < FLOW_STEPS.length - 1 && <span className="text-zinc-300 text-lg">→</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Right: status + CTA */}
            <div className="flex flex-col items-start gap-3">
              <div className="flex items-center gap-2">
                <span className="badge-ok">创作引擎已就绪</span>
                <span className="text-xs text-zinc-400">
                  {data.membership?.planName ?? "免费版"}
                </span>
              </div>
              <Link href="/writing" className="glass-btn-primary !text-sm !py-2 !px-5">开始创作</Link>
            </div>
          </div>
        </div>

        {/* Stats — tighter, stronger numbers */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: "内容创作", value: "12", sub: "篇", color: "text-teal-600" },
            { label: "爆款产出", value: "5", sub: "篇 10w+", color: "text-orange-600" },
            { label: "阅读量", value: "128K", sub: "总阅读", color: "text-sky-600" },
            { label: "转化点击", value: "8.2K", sub: "总点击", color: "text-violet-600" },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="glass-tile p-4">
              <p className={`text-3xl font-extrabold ${color} tracking-tight`}>{value}</p>
              <p className="text-xs text-zinc-400 mt-1">{label} <span className="text-zinc-300">{sub}</span></p>
            </div>
          ))}
        </div>

        {/* Quota — compact row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {Object.entries(data.quota).map(([k, v]) => (
            <div key={k} className="glass-tile px-3 py-2.5">
              <p className="text-[11px] text-zinc-400 truncate">{formatQuotaKey(k)}</p>
              <p className="text-lg font-bold text-zinc-800">{v.remaining}<span className="text-xs text-zinc-400 font-normal">/{v.limit}</span></p>
            </div>
          ))}
        </div>

        {/* Tool grid — hover lift */}
        <h2 className="text-lg font-semibold text-zinc-900 mb-4">创作工具</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 motion-stagger">
          {TOOLS.map(({ icon, label, desc, href }) => (
            <Link key={label} href={href} className="glass-tile p-5 flex items-start gap-4 group hover:shadow-[0_24px_60px_rgba(15,23,42,0.14)] hover:-translate-y-0.5 transition-all duration-200">
              <Image src={icon} alt={label} width={56} height={56} className="shrink-0 tool-icon-motion" />
              <div>
                <h3 className="font-semibold text-zinc-900 text-sm group-hover:text-teal-700 transition-colors">{label}</h3>
                <p className="mt-0.5 text-xs text-zinc-400">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
