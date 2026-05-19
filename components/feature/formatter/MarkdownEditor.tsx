"use client";

export function MarkdownEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-2">编辑</h3>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full h-[500px] rounded-xl border border-zinc-200 p-4 text-sm font-mono resize-y focus:outline-none focus:ring-1 focus:ring-zinc-900"
        placeholder="在此粘贴或编辑 Markdown..."
      />
    </div>
  );
}
