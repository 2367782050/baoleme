export type FormatterConfig = {
  style: string;
  themeColor: string;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  paragraphSpacing: number;
  sidePadding: number;
  imageRounded: number;
  antiAI: boolean;
};

export const DEFAULT_CONFIG: FormatterConfig = {
  style: "green_tech",
  themeColor: "#059669",
  fontFamily: "Microsoft YaHei, PingFang SC, sans-serif",
  fontSize: 16,
  lineHeight: 1.8,
  paragraphSpacing: 18,
  sidePadding: 16,
  imageRounded: 8,
  antiAI: false,
};

const STYLE_THEMES: Record<string, FormatterConfig> = {
  green_tech: { ...DEFAULT_CONFIG, style: "green_tech", themeColor: "#059669" },
  white_minimal: { ...DEFAULT_CONFIG, style: "white_minimal", themeColor: "#374151" },
  blue_column: { ...DEFAULT_CONFIG, style: "blue_column", themeColor: "#2563eb" },
  purple_capsule: { ...DEFAULT_CONFIG, style: "purple_capsule", themeColor: "#7c3aed" },
  gradient_eye: { ...DEFAULT_CONFIG, style: "gradient_eye", themeColor: "#dc2626" },
  light_card: { ...DEFAULT_CONFIG, style: "light_card", themeColor: "#78716c" },
  magazine_line: { ...DEFAULT_CONFIG, style: "magazine_line", themeColor: "#0f172a" },
  tech_clean: { ...DEFAULT_CONFIG, style: "tech_clean", themeColor: "#0284c7" },
  orange_warm: { ...DEFAULT_CONFIG, style: "orange_warm", themeColor: "#ea580c" },
  bw_editor: { ...DEFAULT_CONFIG, style: "bw_editor", themeColor: "#1c1917" },
};

export const STYLE_TEMPLATES = Object.keys(STYLE_THEMES).map((key) => ({
  key,
  name: {
    green_tech: "青绿导读风",
    white_minimal: "留白清新风",
    blue_column: "蓝色专栏风",
    purple_capsule: "紫色胶囊风",
    gradient_eye: "渐变醒目风",
    light_card: "轻卡片风",
    magazine_line: "杂志双线风",
    tech_clean: "科技清爽风",
    orange_warm: "橙色暖调风",
    bw_editor: "黑白编辑风",
  }[key] ?? key,
}));

export function getTemplateConfig(styleKey: string): FormatterConfig {
  return STYLE_THEMES[styleKey] ?? DEFAULT_CONFIG;
}

const ENTITY_MAP: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ENTITY_MAP[ch] || ch);
}

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<script[\s\S]*?\/?>/gi, "")
    .replace(/\bon\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\bon\w+\s*=\s*'[^']*'/gi, "")
    .replace(/\bon\w+\s*=\s*\S+/gi, "")
    .replace(/javascript\s*:/gi, "blocked:")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<embed[\s\S]*?>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "");
}

function formatInline(text: string): string {
  // First escape user HTML, then apply Markdown formatting
  let out = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  // Bold
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__(.+?)__/g, "<strong>$1</strong>");
  // Italic
  out = out.replace(/\*(.+?)\*/g, "<em>$1</em>");
  out = out.replace(/_(.+?)_/g, "<em>$1</em>");
  // Code
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  // Links — note: URL is escaped already so `"` is `&quot;`
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return out;
}

export function renderMarkdown(markdown: string, config: FormatterConfig): string {
  const lines = markdown.split("\n");
  const output: string[] = [];
  let listType: "ul" | "ol" | null = null;

  const closeList = () => {
    if (listType) { output.push(listType === "ul" ? "</ul>" : "</ol>"); listType = null; }
  };

  for (const raw of lines) {
    const line = raw.trim();

    // Blank line
    if (!line) {
      closeList();
      output.push('<p style="margin:0 0 ${ps}px 0">&nbsp;</p>');
      continue;
    }

    // Heading
    const hMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (hMatch) {
      closeList();
      const level = hMatch[1].length;
      const content = formatInline(hMatch[2]).replace(/\\/g, "");
      const sizes = [0, 22, 20, 18, 17, 16, 15];
      const color = level <= 2 ? config.themeColor : "#333";
      output.push(`<h${level} style="font-size:${sizes[level]}px;font-weight:700;color:${color};margin:24px 0 ${config.paragraphSpacing}px 0;padding:0;line-height:1.4">${content}</h${level}>`);
      continue;
    }

    // Unordered list
    const ulMatch = line.match(/^[-*+]\s+(.+)/);
    if (ulMatch) {
      if (listType !== "ul") { closeList(); output.push('<ul style="margin:0 0 ${ps}px 0;padding-left:20px">'); listType = "ul"; }
      output.push(`<li style="margin-bottom:8px;line-height:${config.lineHeight}">${formatInline(ulMatch[1])}</li>`);
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^\d+\.\s+(.+)/);
    if (olMatch) {
      if (listType !== "ol") { closeList(); output.push('<ol style="margin:0 0 ${ps}px 0;padding-left:20px">'); listType = "ol"; }
      output.push(`<li style="margin-bottom:8px;line-height:${config.lineHeight}">${formatInline(olMatch[1])}</li>`);
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      closeList();
      const content = formatInline(line.substring(2));
      output.push(`<blockquote style="border-left:3px solid ${config.themeColor};padding:8px ${config.sidePadding}px;margin:0 0 ${config.paragraphSpacing}px 0;color:#666;background:#f9fafb">${content}</blockquote>`);
      continue;
    }

    // Image
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if (imgMatch) {
      closeList();
      const alt = escapeHtml(imgMatch[1]);
      const src = escapeHtml(imgMatch[2]);
      output.push(`<p style="text-align:center;margin:0 0 ${config.paragraphSpacing}px 0"><img src="${src}" alt="${alt}" style="max-width:100%;border-radius:${config.imageRounded}px;display:block;margin:0 auto"></p>`);
      continue;
    }

    // Horizontal rule
    if (line === "---" || line === "***" || line === "___") {
      closeList();
      output.push(`<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">`);
      continue;
    }

    // Regular paragraph
    closeList();
    const pContent = formatInline(line);
    output.push(`<p style="margin:0 0 ${config.paragraphSpacing}px 0;line-height:${config.lineHeight}">${pContent}</p>`);
  }

  closeList();

  const body = output.join("\n").replace(/\$\{ps\}/g, String(config.paragraphSpacing));
  const result = `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:${config.fontFamily};font-size:${config.fontSize}px;color:#333;max-width:680px;margin:0 auto;padding:${config.sidePadding}px">
<section>${body}</section>
</body>
</html>`;

  return sanitizeHtml(result);
}
