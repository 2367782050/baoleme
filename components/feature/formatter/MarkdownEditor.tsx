"use client";

export function MarkdownEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-2">编辑</h3>
      <textarea value={value} onChange={e => onChange(e.target.value)}
        className="w-full h-[520px] glass-input resize-y text-sm font-mono focus:outline-none focus:ring-0 !rounded-2xl"
        placeholder="在此粘贴或编辑 Markdown..." />
    </div>
  );
}
