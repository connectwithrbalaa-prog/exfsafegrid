/**
 * src/lib/render-markdown.ts
 * Lightweight markdown → safe HTML converter.
 * Handles the common patterns produced by Claude / Gemini ops responses:
 *   headings, bold, italic, inline code, bullet/numbered lists, hr, line breaks.
 * No external dependency required.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineFormat(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

export function renderMarkdown(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let listType: "ul" | "ol" | null = null;

  const closeList = () => {
    if (listType === "ul") { out.push("</ul>"); listType = null; }
    else if (listType === "ol") { out.push("</ol>"); listType = null; }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.startsWith("### ")) {
      closeList();
      out.push(`<h3>${inlineFormat(line.slice(4))}</h3>`);
    } else if (line.startsWith("## ")) {
      closeList();
      out.push(`<h2>${inlineFormat(line.slice(3))}</h2>`);
    } else if (line.startsWith("# ")) {
      closeList();
      out.push(`<h1>${inlineFormat(line.slice(2))}</h1>`);
    } else if (/^\d+\.\s/.test(line)) {
      if (listType !== "ol") { closeList(); out.push("<ol>"); listType = "ol"; }
      out.push(`<li>${inlineFormat(line.replace(/^\d+\.\s/, ""))}</li>`);
    } else if (/^[-*]\s/.test(line)) {
      if (listType !== "ul") { closeList(); out.push("<ul>"); listType = "ul"; }
      out.push(`<li>${inlineFormat(line.slice(2))}</li>`);
    } else if (line === "---" || line === "***" || line === "___") {
      closeList();
      out.push("<hr/>");
    } else if (line.trim() === "") {
      closeList();
      // blank line = paragraph break (small gap)
      out.push(`<div class="md-gap"></div>`);
    } else {
      closeList();
      out.push(`<p>${inlineFormat(line)}</p>`);
    }
  }
  closeList();
  return out.join("");
}
