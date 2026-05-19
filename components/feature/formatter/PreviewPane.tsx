"use client";

export function PreviewPane({ html }: { html: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-2">预览</h3>
      {html ? (
        <div
          className="w-full h-[500px] overflow-y-auto rounded-xl border border-zinc-200 bg-white"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <div className="w-full h-[500px] rounded-xl border border-zinc-200 bg-zinc-50 flex items-center justify-center text-sm text-zinc-400">
          点击「预览」按钮查看渲染效果
        </div>
      )}
    </div>
  );
}
