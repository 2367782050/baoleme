import Link from "next/link";
import Image from "next/image";

const FEATURES = [
  { icon: "/ui-assets/tool-viral-topic.png", label: "爆款素材", desc: "发现全网高质量爆款内容" },
  { icon: "/ui-assets/tool-template.png", label: "提示词库", desc: "AI 生成和管理高分提示词" },
  { icon: "/ui-assets/tool-ai-writing.png", label: "智能创作", desc: "AI 辅助生成高质量文章" },
  { icon: "/ui-assets/tool-image-tool.png", label: "一键排版", desc: "Markdown 转公众号 HTML" },
  { icon: "/ui-assets/admin-overview.png", label: "公众号管理", desc: "管理授权与草稿推送" },
  { icon: "/ui-assets/admin-membership.png", label: "会员推广", desc: "灵活套餐与推广返佣" },
];

export default function Home() {
  return (
    <div className="glass-page">
      <div className="mx-auto max-w-6xl px-6 pt-24 pb-20">
        {/* Hero section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-zinc-900 tracking-tight">
            爆了么
          </h1>
          <p className="mt-4 text-lg text-zinc-500 max-w-lg mx-auto leading-relaxed">
            从找选题到一键排版，自媒体创作全流程工具
          </p>
          <div className="mt-8 flex gap-4 justify-center">
            <Link href="/register" className="glass-btn-primary !px-6 !py-2.5 !text-base">开始创作</Link>
            <Link href="/login" className="glass-btn-secondary !px-6 !py-2.5 !text-base">登录</Link>
          </div>
        </div>

        {/* Hero dashboard card */}
        <div className="glass-card p-8 mb-12">
          <div className="flex flex-col lg:flex-row items-center gap-8">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-zinc-900">AI 助力创作，让内容更容易爆</h2>
              <p className="mt-3 text-zinc-500 leading-relaxed max-w-md">
                聚合全平台爆款素材，AI 生成高质量提示词，智能辅助写作，一键排版发布到公众号。
              </p>
              <div className="flex gap-3 mt-6">
                <div className="glass-tile px-4 py-2 text-sm text-zinc-600">
                  <span className="font-bold text-teal-600">100K+</span> 爆款素材
                </div>
                <div className="glass-tile px-4 py-2 text-sm text-zinc-600">
                  <span className="font-bold text-sky-600">AI</span> 智能创作
                </div>
                <div className="glass-tile px-4 py-2 text-sm text-zinc-600">
                  <span className="font-bold text-violet-600">一键</span> 排版发布
                </div>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-sky-300/60 to-sky-400/40" />
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-teal-300/60 to-emerald-400/40 mt-6" />
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-amber-200/60 to-yellow-300/40" />
            </div>
          </div>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ icon, label, desc }) => (
            <Link key={label} href={label === "爆款素材" ? "/materials" : label === "提示词库" ? "/prompts" : label === "智能创作" ? "/writing" : label === "一键排版" ? "/formatter" : label === "公众号管理" ? "/official-accounts" : "/membership"} className="glass-tile p-5 flex items-start gap-4 group hover:shadow-[0_20px_50px_rgba(15,23,42,0.10)] transition-shadow">
              <Image src={icon} alt={label} width={44} height={44} className="shrink-0" />
              <div>
                <h3 className="font-semibold text-zinc-900 group-hover:text-teal-700 transition-colors">{label}</h3>
                <p className="mt-1 text-sm text-zinc-400">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
