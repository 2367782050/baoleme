export function HowToFind() {
  return (
    <div>
      <h2 className="text-lg font-semibold text-zinc-900 mb-4">如何找对标</h2>

      <div className="prose prose-sm max-w-none text-zinc-600 space-y-4">
        <div className="rounded-xl border border-zinc-200 p-6">
          <h3 className="font-semibold text-zinc-900 text-base mb-2">1. 确定你的赛道</h3>
          <p className="text-sm">
            选择你的内容领域，如财经、科技、健康、教育等。不同赛道的热门内容特征差异很大，先定位再对标。
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 p-6">
          <h3 className="font-semibold text-zinc-900 text-base mb-2">2. 利用公众号榜单</h3>
          <p className="text-sm">
            在「公众号榜单」tab 中按行业筛选，查看排名靠前的公众号。关注其头条平均阅读数、点赞数和原创指数，判断内容质量和传播力。
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 p-6">
          <h3 className="font-semibold text-zinc-900 text-base mb-2">3. 利用热搜榜</h3>
          <p className="text-sm">
            在「热搜榜」tab 中查看各平台当前热门话题，按平台筛选。热点话题往往是爆款文章的选题来源。
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 p-6">
          <h3 className="font-semibold text-zinc-900 text-base mb-2">4. 收藏对标账号</h3>
          <p className="text-sm">
            在榜单中点击「收藏」按钮保存对标账号，方便随时回顾。收藏后可以在导出时筛选已收藏的账号。
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 p-6">
          <h3 className="font-semibold text-zinc-900 text-base mb-2">5. 引用创作</h3>
          <p className="text-sm">
            找到对标素材后，点击「引用创作」按钮，系统将自动带入素材信息进入智能创作流程，使用 AI 生成高分文章。
          </p>
        </div>
      </div>
    </div>
  );
}
