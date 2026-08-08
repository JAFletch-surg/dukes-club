/* ══════════════════════════════════════════════════════════════════
   HTML SNIPPETS — the INSERT bar's contents

   Its own module rather than part of the editor: the posts block editor
   wants the snippets without the visual editor, and importing them from
   rich-text-field pulled the whole of TipTap into that page's bundle for
   the sake of an array.
   ══════════════════════════════════════════════════════════════════ */

export const HTML_SNIPPETS: { label: string; snippet: string }[] = [
  { label: 'Heading', snippet: '<h3>Section heading</h3>' },
  { label: 'Bold', snippet: '<strong>bold text</strong>' },
  { label: 'Italic', snippet: '<em>italic text</em>' },
  { label: 'Link', snippet: '<a href="https://example.com" target="_blank">link text</a>' },
  { label: 'Bullets', snippet: '<ul>\n  <li>First point</li>\n  <li>Second point</li>\n</ul>' },
  { label: 'Numbered', snippet: '<ol>\n  <li>First step</li>\n  <li>Second step</li>\n</ol>' },
  { label: 'Table', snippet: '<table>\n  <thead><tr><th>Column</th><th>Column</th></tr></thead>\n  <tbody><tr><td>Cell</td><td>Cell</td></tr></tbody>\n</table>' },
  { label: 'Callout', snippet: '<div class="callout">\n  <strong>Note</strong> — something worth highlighting.\n</div>' },
  { label: 'Divider', snippet: '<hr />' },
]
