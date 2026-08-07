/* ══════════════════════════════════════════════════════════════════
   RICH TEXT — HTML segments inside admin free-text fields

   Admins write plain paragraphs and drop HTML snippets in where they
   need formatting (<strong>, <ul>, <a>, <table>, an embed…). Three
   helpers cover the whole journey:

     richTextToHtml()  free text + HTML segments → clean HTML
     sanitizeHtml()    allow-list scrub, run again at render time
     htmlToPlainText() HTML → plain text for excerpts, cards, search

   sanitizeHtml is a self-contained string parser — no DOM, no deps —
   so it behaves identically during SSR and in the browser.
   ══════════════════════════════════════════════════════════════════ */

/* Attributes permitted on every allowed tag. */
const GLOBAL_ATTRS = ['class', 'id', 'title', 'style', 'dir', 'lang']

/* Tag → extra attributes permitted on that tag. A tag absent from this
   map is dropped (its children are kept unless it is in DROP_CONTENT). */
const ALLOWED_TAGS: Record<string, string[]> = {
  p: [], br: [], hr: [], span: [], div: [], section: [],
  h1: [], h2: [], h3: [], h4: [], h5: [], h6: [],
  strong: [], b: [], em: [], i: [], u: [], s: [], del: [], ins: [], mark: [],
  small: [], sub: [], sup: [], abbr: [], code: [], pre: [], kbd: [], time: ['datetime'],
  ul: [], ol: ['start', 'type', 'reversed'], li: ['value'], dl: [], dt: [], dd: [],
  blockquote: ['cite'], cite: [], q: ['cite'],
  a: ['href', 'target', 'rel', 'download'],
  img: ['src', 'alt', 'width', 'height', 'loading'],
  figure: [], figcaption: [],
  table: [], thead: [], tbody: [], tfoot: [], caption: [], colgroup: [], col: ['span'],
  tr: [], th: ['colspan', 'rowspan', 'scope', 'headers'], td: ['colspan', 'rowspan', 'headers'],
  iframe: ['src', 'width', 'height', 'allow', 'allowfullscreen', 'frameborder', 'loading'],
  video: ['src', 'controls', 'poster', 'width', 'height', 'preload', 'muted', 'loop', 'playsinline'],
  audio: ['src', 'controls', 'preload', 'loop'],
  source: ['src', 'type', 'srcset', 'media'],
  // Inline icons only — no <use>, <script>, <foreignObject> or animation,
  // which are the parts of SVG that can execute or pull in outside content.
  svg: ['viewbox', 'width', 'height', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'xmlns', 'role', 'aria-hidden', 'focusable', 'preserveaspectratio'],
  path: ['d', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'fill-rule', 'clip-rule', 'transform'],
  g: ['fill', 'stroke', 'stroke-width', 'transform'],
  circle: ['cx', 'cy', 'r', 'fill', 'stroke', 'stroke-width'],
  ellipse: ['cx', 'cy', 'rx', 'ry', 'fill', 'stroke', 'stroke-width'],
  rect: ['x', 'y', 'width', 'height', 'rx', 'ry', 'fill', 'stroke', 'stroke-width'],
  line: ['x1', 'y1', 'x2', 'y2', 'stroke', 'stroke-width', 'stroke-linecap'],
  polyline: ['points', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin'],
  polygon: ['points', 'fill', 'stroke', 'stroke-width'],
}

/* Elements dropped along with everything inside them. */
const DROP_CONTENT = new Set([
  'script', 'style', 'noscript', 'template', 'iframe', 'object', 'embed',
  'form', 'input', 'button', 'select', 'option', 'textarea', 'label',
  'link', 'meta', 'base', 'title', 'head', 'math',
  'use', 'foreignobject', 'animate', 'animatetransform', 'animatemotion', 'set',
])

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])

/* Attributes whose value is a URL and therefore needs scheme checking. */
const URL_ATTRS = new Set(['href', 'src', 'cite', 'poster', 'srcset'])

/* Only these hosts may be framed — everything else loses the <iframe>. */
const IFRAME_HOSTS = [
  'www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com',
  'player.vimeo.com', 'www.google.com', 'google.com', 'maps.google.com',
  'open.spotify.com', 'w.soundcloud.com', 'docs.google.com',
]

/* Block-level tags: a free-text chunk opening with one of these is
   already structured markup and is passed through un-wrapped. */
const BLOCK_TAGS = new Set([
  'p', 'div', 'section', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
  'dl', 'blockquote', 'pre', 'hr', 'table', 'thead', 'tbody', 'tr', 'td', 'th',
  'figure', 'figcaption', 'img', 'iframe', 'video', 'audio', 'article', 'aside',
])

/* Tags that force a line break when flattening to plain text. */
const PLAIN_BREAK_TAGS = new Set([
  'p', 'div', 'section', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'li', 'tr', 'blockquote', 'figure', 'figcaption', 'pre', 'table', 'ul', 'ol',
])

/** Tags an editor may safely offer as quick-insert snippets. */
export const RICH_TEXT_ALLOWED_TAGS = Object.keys(ALLOWED_TAGS).sort()

/* ── Low-level helpers ───────────────────────────────────────────── */

/** Escape a run of text, leaving already-valid entities intact. */
function escapeText(text: string): string {
  return text
    .replace(/&(?!(?:#\d+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]{1,31});)/g, '&amp;')
    .replace(/</g, '&lt;')
}

function escapeAttr(value: string): string {
  return value
    .replace(/&(?!(?:#\d+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]{1,31});)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–',
  mdash: '—', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“',
  rdquo: '”', pound: '£', euro: '€', copy: '©', reg: '®', trade: '™', deg: '°',
}

function decodeEntities(text: string): string {
  return text.replace(/&(#\d+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]{1,31});/g, (match, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X'
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match
    }
    const named = NAMED_ENTITIES[body.toLowerCase()]
    return named !== undefined ? named : match
  })
}

/** Strip characters attackers use to smuggle a scheme past a check. */
function normaliseUrl(value: string): string {
  return decodeEntities(value).replace(/[\u0000-\u0020\u007f]/g, '').toLowerCase()
}

function isSafeUrl(attr: string, value: string, tag: string): boolean {
  const url = normaliseUrl(value)
  if (!url) return false
  // Relative, root-relative, protocol-relative, anchor and query URLs are fine.
  if (/^(?:[/#?]|\.\.?\/)/.test(url)) return true
  if (!/^[a-z][a-z0-9+.-]*:/.test(url)) return true
  if (/^(?:https?|mailto|tel):/.test(url)) return true
  // Inline images only — data: SVG can carry script.
  if (attr === 'src' && tag === 'img' && /^data:image\/(?:png|jpe?g|gif|webp|avif);base64,/.test(url)) return true
  return false
}

function isAllowedFrame(src: string): boolean {
  const url = normaliseUrl(src)
  const match = /^https:\/\/([^/?#]+)/.exec(url)
  if (!match) return false
  const host = match[1].split('@').pop() || ''
  return IFRAME_HOSTS.includes(host.split(':')[0])
}

/** A style value is kept only if it cannot reach out to the network or JS. */
function isSafeStyle(value: string): boolean {
  const style = decodeEntities(value).toLowerCase()
  if (/expression\s*\(|javascript:|behaviou?r\s*:|@import|<|\\/.test(style)) return false
  if (/url\s*\(/.test(style) && !/url\s*\(\s*['"]?(?:https?:|\/)/.test(style)) return false
  return true
}

/** Index of the `>` closing the tag that starts at `start`, quotes respected. */
function findTagEnd(html: string, start: number): number {
  let quote: string | null = null
  for (let i = start + 1; i < html.length; i++) {
    const char = html[i]
    if (quote) { if (char === quote) quote = null; continue }
    if (char === '"' || char === "'") { quote = char; continue }
    if (char === '>') return i
  }
  return -1
}

const ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g

function parseAttrs(raw: string): { name: string; value: string }[] {
  const attrs: { name: string; value: string }[] = []
  ATTR_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = ATTR_RE.exec(raw)) !== null) {
    attrs.push({ name: match[1].toLowerCase(), value: match[2] ?? match[3] ?? match[4] ?? '' })
  }
  return attrs
}

/* ── sanitizeHtml ────────────────────────────────────────────────── */

/**
 * Scrub author-supplied HTML down to an allow-list of tags, attributes
 * and URL schemes, then balance any tags left open. Safe to run on
 * already-sanitised markup — it is idempotent.
 */
export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return ''

  let out = ''
  const open: string[] = []
  let i = 0

  while (i < html.length) {
    const lt = html.indexOf('<', i)
    if (lt === -1) { out += escapeText(html.slice(i)); break }
    if (lt > i) out += escapeText(html.slice(i, lt))

    // Comments, doctypes and processing instructions are dropped outright.
    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4)
      i = end === -1 ? html.length : end + 3
      continue
    }
    if (html.startsWith('<!', lt) || html.startsWith('<?', lt)) {
      const end = html.indexOf('>', lt)
      i = end === -1 ? html.length : end + 1
      continue
    }

    // No whitespace between `<` and the tag name — `a < b` stays text.
    const nameMatch = /^<(\/?)([a-zA-Z][a-zA-Z0-9-]*)/.exec(html.slice(lt, lt + 64))
    if (!nameMatch) { out += '&lt;'; i = lt + 1; continue }

    const tagEnd = findTagEnd(html, lt)
    if (tagEnd === -1) { out += escapeText(html.slice(lt)); break }

    const isClose = nameMatch[1] === '/'
    const tag = nameMatch[2].toLowerCase()
    const rawAttrs = html.slice(lt + nameMatch[0].length, tagEnd).replace(/\/$/, '')
    const selfClosing = html[tagEnd - 1] === '/'
    i = tagEnd + 1

    if (isClose) {
      const depth = open.lastIndexOf(tag)
      if (depth !== -1) {
        // Close anything the author left dangling inside this element.
        for (let d = open.length - 1; d >= depth; d--) out += `</${open[d]}>`
        open.length = depth
      }
      continue
    }

    if (DROP_CONTENT.has(tag)) {
      if (tag === 'iframe') {
        const src = parseAttrs(rawAttrs).find(a => a.name === 'src')?.value || ''
        if (isAllowedFrame(src)) {
          out += buildTag('iframe', parseAttrs(rawAttrs))
          if (selfClosing) out += '</iframe>'
          else open.push('iframe')
          continue
        }
      }
      if (!VOID_TAGS.has(tag) && !selfClosing) {
        // Skip forward past the matching close tag, content and all.
        const closeRe = new RegExp(`</\\s*${tag}\\s*>`, 'i')
        const rest = html.slice(i)
        const closeMatch = closeRe.exec(rest)
        i = closeMatch ? i + closeMatch.index + closeMatch[0].length : html.length
      }
      continue
    }

    // Unknown tag: drop the tag itself but keep whatever it wraps.
    if (!(tag in ALLOWED_TAGS)) continue

    out += buildTag(tag, parseAttrs(rawAttrs))
    if (!VOID_TAGS.has(tag) && !selfClosing) open.push(tag)
  }

  for (let d = open.length - 1; d >= 0; d--) out += `</${open[d]}>`
  return out
}

function buildTag(tag: string, attrs: { name: string; value: string }[]): string {
  const permitted = ALLOWED_TAGS[tag] || []
  const kept: string[] = []
  const seen = new Set<string>()
  let targetBlank = false

  for (const { name, value } of attrs) {
    if (name.startsWith('on') || seen.has(name)) continue
    if (!permitted.includes(name) && !GLOBAL_ATTRS.includes(name)) continue
    if (URL_ATTRS.has(name) && !isSafeUrl(name, value, tag)) continue
    if (name === 'style' && !isSafeStyle(value)) continue
    if (name === 'target') {
      if (value !== '_blank') continue
      targetBlank = true
      seen.add(name)
      kept.push('target="_blank"')
      continue
    }
    // rel is rebuilt below so a new tab always gets noopener.
    if (name === 'rel') continue
    seen.add(name)
    kept.push(value === '' ? name : `${name}="${escapeAttr(value)}"`)
  }

  // A new tab never gets a handle on the opener window.
  if (targetBlank) kept.push('rel="noopener noreferrer"')

  const attrString = kept.length > 0 ? ` ${kept.join(' ')}` : ''
  return VOID_TAGS.has(tag) ? `<${tag}${attrString} />` : `<${tag}${attrString}>`
}

/* ── richTextToHtml ──────────────────────────────────────────────── */

/**
 * Turn a free-text field into HTML. Blank lines separate paragraphs and
 * single newlines become <br />, but any chunk that already starts with
 * a block-level tag is left exactly as the author wrote it — that is
 * what makes "drop an HTML segment mid-paragraph" work.
 *
 * Running this on its own output is a no-op, so a field can be edited,
 * saved and re-edited without the markup drifting.
 */
export function richTextToHtml(source: string | null | undefined): string {
  if (!source || !source.trim()) return ''

  const chunks = source.replace(/\r\n?/g, '\n').split(/\n{2,}/)
  const html = chunks
    .map(chunk => chunk.trim())
    .filter(Boolean)
    .map(chunk => {
      const opening = /^<\s*([a-zA-Z][a-zA-Z0-9-]*)/.exec(chunk)
      if (opening && BLOCK_TAGS.has(opening[1].toLowerCase())) return chunk
      return `<p>${chunk.replace(/\n/g, '<br />')}</p>`
    })
    .join('\n')

  return sanitizeHtml(html)
}

/** True when the text carries markup worth rendering as HTML. */
export function containsHtml(source: string | null | undefined): boolean {
  return !!source && /<[a-zA-Z][a-zA-Z0-9-]*(\s[^<>]*)?\/?>/.test(source)
}

/* ── htmlToPlainText ─────────────────────────────────────────────── */

/** Flatten HTML to readable plain text for excerpts, cards and search. */
export function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return ''

  let text = html.replace(/<!--[\s\S]*?-->/g, '')
  text = text.replace(/<(script|style)[\s\S]*?<\/\1\s*>/gi, '')
  text = text.replace(/<\/?([a-zA-Z][a-zA-Z0-9-]*)[^>]*>/g, (_m, tag: string) =>
    PLAIN_BREAK_TAGS.has(tag.toLowerCase()) ? '\n' : ''
  )

  return decodeEntities(text)
    .replace(/[^\S\n]+/g, ' ')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n')
}
