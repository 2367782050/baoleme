"use client";

import { DEFAULT_CONFIG, STYLE_TEMPLATES, getTemplateConfig } from "@/lib/services/formatter.service";
import type { FormatterConfig } from "@/lib/services/formatter.service";

const FONTS = ["Microsoft YaHei, PingFang SC, sans-serif", "SimSun,宋体,serif", "SimHei,黑体,sans-serif", "KaiTi,楷体,serif", "Georgia,serif", "system-ui,sans-serif"];

export function StylePanel({ config, onChange }: { config: FormatterConfig; onChange: (c: FormatterConfig) => void }) {
  function set<K extends keyof FormatterConfig>(k: K, v: FormatterConfig[K]) { onChange({ ...config, [k]: v }); }

  return (
    <div className="space-y-4 text-sm">
      <h3 className="font-semibold text-zinc-900">样式模板</h3>

      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">模板</label>
        <select value={config.style} onChange={e => onChange({ ...DEFAULT_CONFIG, ...getTemplateConfig(e.target.value), style: e.target.value as FormatterConfig["style"] })}
          className="w-full glass-input text-sm !py-1.5">
          {STYLE_TEMPLATES.map(t => <option key={t.key} value={t.key}>{t.name}</option>)}</select>
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">主题色</label>
        <div className="flex gap-2">
          <input type="color" value={config.themeColor} onChange={e => set("themeColor", e.target.value)} className="w-8 h-8 rounded-lg border border-white/30 cursor-pointer" />
          <input type="text" value={config.themeColor} onChange={e => set("themeColor", e.target.value)} className="flex-1 glass-input text-sm font-mono !py-1.5" /></div>
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">字体</label>
        <select value={config.fontFamily} onChange={e => set("fontFamily", e.target.value)} className="w-full glass-input text-sm !py-1.5">
          {FONTS.map(f => <option key={f} value={f}>{f.split(",")[0]}</option>)}</select>
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">字号 ({config.fontSize}px)</label>
        <input type="range" min={12} max={28} value={config.fontSize} onChange={e => set("fontSize", Number(e.target.value))} className="w-full accent-teal-500" />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">行距 ({config.lineHeight})</label>
        <input type="range" min={1.2} max={4} step={0.1} value={config.lineHeight} onChange={e => set("lineHeight", Number(e.target.value))} className="w-full accent-teal-500" />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">段距 ({config.paragraphSpacing}px)</label>
        <input type="range" min={0} max={60} value={config.paragraphSpacing} onChange={e => set("paragraphSpacing", Number(e.target.value))} className="w-full accent-teal-500" />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">两侧边距 ({config.sidePadding}px)</label>
        <input type="range" min={0} max={60} value={config.sidePadding} onChange={e => set("sidePadding", Number(e.target.value))} className="w-full accent-teal-500" />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">图片圆角 ({config.imageRounded}px)</label>
        <input type="range" min={0} max={30} value={config.imageRounded} onChange={e => set("imageRounded", Number(e.target.value))} className="w-full accent-teal-500" />
      </div>
    </div>
  );
}
