import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center">
      {/* Hero */}
      <section className="w-full py-24 px-6 text-center bg-gradient-to-b from-zinc-50 to-white">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
          自媒体爆款智能创作工作台
        </h1>
        <p className="mt-4 text-lg text-zinc-500 max-w-lg mx-auto">
          发现爆款素材，生成高分提示词，AI 辅助写作，一键排版发布。
        </p>
        <div className="mt-8 flex gap-4 justify-center">
          <Link
            href="/register"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-6 text-sm font-medium text-white hover:bg-zinc-800 transition-colors"
          >
            开始创作
          </Link>
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-zinc-200 px-6 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            登录
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="w-full max-w-5xl px-6 py-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              title: "爆款素材",
              desc: "公众号榜单、精品对标号、热搜榜，发现高传播内容。",
            },
            {
              title: "提示词库",
              desc: "AI 生成高分提示词，分组管理，随时调用。",
            },
            {
              title: "智能创作",
              desc: "选择提示词与素材，AI 自动生成高质量文章。",
            },
            {
              title: "一键排版",
              desc: "Markdown 编辑，多模板预览，一键复制到公众号编辑器。",
            },
            {
              title: "公众号草稿",
              desc: "管理公众号授权，批量推送草稿。",
            },
            {
              title: "会员配额",
              desc: "灵活的会员套餐，按需使用创作配额。",
            },
          ].map(({ title, desc }) => (
            <div
              key={title}
              className="rounded-xl border border-zinc-200 p-6 hover:border-zinc-300 transition-colors"
            >
              <h3 className="font-semibold text-zinc-900">{title}</h3>
              <p className="mt-2 text-sm text-zinc-500">{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
