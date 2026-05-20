"use client";

export function PreviewPane({ html }: { html: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-2">预览</h3>
      {html ? (
        <div className="w-full h-[520px] overflow-y-auto rounded-2xl border border-white/60 bg-white/80 p-4"
          dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <div className="w-full h-[520px] rounded-2xl border border-white/60 bg-white/40 flex items-center justify-center">
          <p className="text-sm text-zinc-400 text-center px-4">点击「预览」按钮<br />查看渲染效果</p>
        </div>
      )}
    </div>
  );
}
