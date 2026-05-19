import "dotenv/config";
import { describe, it, expect } from "vitest";
import { renderMarkdown, DEFAULT_CONFIG, getTemplateConfig, STYLE_TEMPLATES } from "../lib/services/formatter.service.js";

describe("renderMarkdown", () => {
  const cfg = DEFAULT_CONFIG;

  it("renders heading", () => {
    const html = renderMarkdown("# 标题", cfg);
    expect(html).toContain("<h1");
    expect(html).toContain("标题");
    expect(html).not.toContain("<script");
  });

  it("renders paragraphs", () => {
    const html = renderMarkdown("段落一\n\n段落二", cfg);
    expect(html).toContain("段落一");
    expect(html).toContain("段落二");
  });

  it("renders bold and italic", () => {
    const html = renderMarkdown("**bold** and *italic*", cfg);
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
  });

  it("renders unordered list", () => {
    const html = renderMarkdown("- item1\n- item2", cfg);
    expect(html).toContain("<ul");
    expect(html).toContain("<li");
    expect(html).toContain("item1");
    expect(html).toContain("item2");
    expect(html).toContain("</ul>");
  });

  it("renders unordered list and closes with </ul>", () => {
    const html = renderMarkdown("- a\n- b", cfg);
    expect(html).toContain("<ul");
    expect(html).toContain("</ul>");
  });

  it("renders ordered list and closes with </ol> not </ul>", () => {
    const html = renderMarkdown("1. first\n2. second", cfg);
    expect(html).toContain("<ol");
    expect(html).toContain("</ol>");
    expect(html).toContain("first");
    expect(html).toContain("second");
  });

  it("mixed ul then ol closes each properly", () => {
    const html = renderMarkdown("- a\n- b\n\n1. x\n2. y", cfg);
    const joined = (html.match(/<ul|<ol|<\/ul>|<\/ol>/g) || []).join("");
    expect(joined).toBe("<ul</ul><ol</ol>");
  });

  it("renders blockquote", () => {
    const html = renderMarkdown("> quoted text", cfg);
    expect(html).toContain("<blockquote");
    expect(html).toContain("quoted text");
  });

  it("renders images with border-radius", () => {
    const html = renderMarkdown("![alt](http://example.com/img.png)", cfg);
    expect(html).toContain("<img");
    expect(html).toContain("border-radius");
  });

  it("renders links", () => {
    const html = renderMarkdown("[text](http://example.com)", cfg);
    expect(html).toContain('<a href="http://example.com">text</a>');
  });

  it("applies themeColor to headings", () => {
    const html = renderMarkdown("## Test", { ...cfg, themeColor: "#ff0000" });
    expect(html).toContain("#ff0000");
  });

  it("applies fontSize to body", () => {
    const html = renderMarkdown("text", { ...cfg, fontSize: 20 });
    expect(html).toContain("font-size:20px");
  });

  it("applies lineHeight to paragraphs", () => {
    const html = renderMarkdown("text", { ...cfg, lineHeight: 2.5 });
    expect(html).toContain("line-height:2.5");
  });

  it("applies paragraphSpacing", () => {
    const html = renderMarkdown("p1\n\np2", { ...cfg, paragraphSpacing: 30 });
    expect(html).toContain("margin:0 0 30px 0");
  });

  it("applies sidePadding", () => {
    const html = renderMarkdown("text", { ...cfg, sidePadding: 32 });
    expect(html).toContain("padding:32px");
  });

  it("applies imageRounded", () => {
    const html = renderMarkdown("![x](x.png)", { ...cfg, imageRounded: 12 });
    expect(html).toContain("border-radius:12px");
  });

  it("strips script tags", () => {
    const html = renderMarkdown("<script>alert('xss')</script>", cfg);
    expect(html).not.toContain("<script>");
  });

  it("strips event handlers", () => {
    const html = renderMarkdown('<p onclick="alert(1)">text</p>', cfg);
    expect(html).not.toContain("onclick=");
  });

  it("strips javascript: URLs", () => {
    const html = renderMarkdown('[click](javascript:alert(1))', cfg);
    expect(html).not.toContain("javascript:");
  });

  it("escapes HTML entities", () => {
    const html = renderMarkdown('<div class="test">&</div>', cfg);
    expect(html).not.toContain('<div class="test">');
    expect(html).toContain("&amp;");
  });
});

describe("getTemplateConfig", () => {
  it("returns config for valid style key", () => {
    const c = getTemplateConfig("blue_column");
    expect(c.themeColor).toBe("#2563eb");
    expect(c.style).toBe("blue_column");
  });

  it("returns default for invalid key", () => {
    const c = getTemplateConfig("nonexistent");
    expect(c.style).toBe(DEFAULT_CONFIG.style);
  });
});

describe("STYLE_TEMPLATES", () => {
  it("has 10 templates", () => {
    expect(STYLE_TEMPLATES.length).toBe(10);
  });
});
