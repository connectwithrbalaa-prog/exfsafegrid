/**
 * Lightweight markdown → HTML converter for briefing/watchlist content.
 */
export function renderMarkdown(md: string): string {
  let html = md
    // headings
    .replace(/^#### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // bold & italic
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // code
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // hr
    .replace(/^---$/gm, "<hr/>")
    // unordered lists
    .replace(/^[-*] (.+)$/gm, "<li>$1</li>");

  // wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>");
  // paragraphs for remaining lines
  html = html.replace(/^(?!<[hulo]|<hr)(.*\S.*)$/gm, "<p>$1</p>");

  return html;
}
