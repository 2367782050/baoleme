import Link from "next/link";
import Image from "next/image";

const FEATURES = [
  { icon: "/ui-assets/tool-viral-topic.png", label: "爆款素材", desc: "发现全网高质量爆款内容" },
  { icon: "/ui-assets/tool-template.png", label: "提示词库", desc: "AI 生成和管理高分提示词" },
  { icon: "/ui-assets/tool-ai-writing.png", label: "智能创作", desc: "AI 辅助生成高质量文章" },
  { icon: "/ui-assets/tool-image-tool.png", label: "一键排版", desc: "文章内容转公众号排版" },
  { icon: "/ui-assets/admin-overview.png", label: "公众号管理", desc: "管理授权与草稿推送" },
  { icon: "/ui-assets/admin-membership.png", label: "会员推广", desc: "灵活套餐与推广返佣" },
];

const HERO_CARDS = [
  { icon: "/ui-assets/tool-viral-topic.png", title: "今日爆款选题", desc: "全平台热搜、高传播内容实时发现" },
  { icon: "/ui-assets/tool-ai-writing.png", title: "AI 生成文章", desc: "选素材、定提示词，AI 辅助高质量写作" },
  { icon: "/ui-assets/tool-image-tool.png", title: "一键排版发布", desc: "文章内容转精美公众号排版" },
];

export default function Home() {
  return (
    <div className="glass-page">
      <div className="mx-auto max-w-6xl px-6 pt-28 pb-20">
        {/* Hero */}
        <div className="flex flex-col lg:flex-row items-center gap-12 mb-16">
          {/* Left: brand + CTA */}
          <div className="flex-1 text-center lg:text-left">
            <h1 className="text-5xl sm:text-6xl font-extrabold text-zinc-900 tracking-tight">
              爆了么
            </h1>
            <p className="mt-4 text-lg text-zinc-500 max-w-md leading-relaxed">
              从找选题到一键排版，自媒体创作全流程工具
            </p>
            <div className="mt-8 flex gap-4 justify-center lg:justify-start">
              <Link href="/register" className="glass-btn-primary !px-7 !py-3 !text-base">开始使用</Link>
              <Link href="/login" className="glass-btn-secondary !px-7 !py-3 !text-base">登录账号</Link>
            </div>
          </div>

          {/* Right: product preview cards */}
          <div className="flex-1">
            <div className="glass-card p-6 space-y-3">
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">产品预览</p>
              {HERO_CARDS.map(({ icon, title, desc }) => (
                <div key={title} className="flex items-center gap-4 p-3 rounded-2xl bg-white/40">
                  <Image src={icon} alt={title} width={44} height={44} className="shrink-0" />
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-zinc-800">{title}</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-2 pt-1">
                <span className="badge-ok">创作引擎已就绪</span>
                <span className="text-xs text-zinc-400">创作引擎已就绪</span>
              </div>
            </div>
          </div>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 motion-stagger">
          {FEATURES.map(({ icon, label, desc }) => (
            <Link key={label} href={label === "爆款素材" ? "/materials" : label === "提示词库" ? "/prompts" : label === "智能创作" ? "/writing" : label === "一键排版" ? "/formatter" : label === "公众号管理" ? "/official-accounts" : "/membership"} className="glass-tile p-5 flex items-start gap-4 group hover:shadow-[0_24px_60px_rgba(15,23,42,0.12)] hover:-translate-y-0.5 transition-all duration-200">
              <Image src={icon} alt={label} width={56} height={56} className="shrink-0 tool-icon-motion" />
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
