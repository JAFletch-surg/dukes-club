// The member round-up digest email.
//
// Deliberately not built on the shared `layout()` in templates.ts: the
// transactional emails are a single narrow column of prose, whereas the digest
// is an editorial newsletter with cards, a date rail and a preference footer.
// It shares the brand tokens instead.
//
// Constraints this markup is written to: tables for layout (Outlook ignores
// flex/grid), every style inline (Gmail strips <head> styles on the mobile web
// client — the <style> block below is progressive enhancement only), no
// background images, and nothing that breaks when images are blocked.

import { escapeHtml, LOGO_URL } from './templates'
import type { DigestEvent, DigestFrequency, DigestPost } from './digest'

const NAVY = '#0F1F3D'
const GOLD = '#E5A718'
const CANVAS = '#F5F5F0'
const CARD_BORDER = '#E8E6E1'
const BODY_TEXT = '#3F4550'
const MUTED = '#8A8F98'

const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif`

const CADENCE_DESCRIPTION: Record<DigestFrequency, string> = {
  weekly: 'You receive this round-up once a week.',
  fortnightly: 'You receive this round-up every two weeks.',
  monthly: 'You receive this round-up every four weeks.',
  never: 'You receive this round-up occasionally.',
}

const EYEBROW: Record<DigestFrequency, string> = {
  weekly: 'The Weekly Round-Up',
  fortnightly: 'The Fortnightly Round-Up',
  monthly: 'The Monthly Round-Up',
  never: 'The Round-Up',
}

function fmt(value: string, options: Intl.DateTimeFormatOptions): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', ...options }).format(date)
}

/** "Fri 20 Mar, 9:00am" — and a date range when an event spans days. */
function eventWhen(event: DigestEvent): string {
  const start = fmt(event.startsAt, { weekday: 'short', day: 'numeric', month: 'long' })
  const time = fmt(event.startsAt, { hour: 'numeric', minute: '2-digit', hour12: true }).replace(' ', '')

  if (event.endsAt) {
    const sameDay = fmt(event.startsAt, { year: 'numeric', month: 'numeric', day: 'numeric' })
      === fmt(event.endsAt, { year: 'numeric', month: 'numeric', day: 'numeric' })
    if (!sameDay) {
      return `${start} – ${fmt(event.endsAt, { day: 'numeric', month: 'long' })}`
    }
  }
  return `${start} · ${time}`
}

function pill(text: string, background: string, color: string): string {
  return `<span style="display:inline-block;padding:4px 10px;border-radius:20px;background-color:${background};color:${color};font-size:10px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;">${escapeHtml(text)}</span>`
}

/**
 * Section heading: a small gold rule above a navy title, with an optional
 * count on the right so the reader can see the shape of the email at a glance.
 */
function sectionHeading(title: string, count: number): string {
  return `
    <tr>
      <td style="padding:36px 0 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="font-family:${FONT};">
              <div style="width:32px;height:3px;background-color:${GOLD};border-radius:2px;margin-bottom:12px;"></div>
              <span style="font-size:19px;font-weight:700;color:${NAVY};letter-spacing:-0.2px;">${escapeHtml(title)}</span>
            </td>
            <td align="right" style="font-family:${FONT};font-size:12px;color:${MUTED};vertical-align:bottom;padding-bottom:2px;">
              ${count} ${count === 1 ? 'item' : 'items'}
            </td>
          </tr>
        </table>
      </td>
    </tr>`
}

/**
 * Event card. The date sits in a gold rail on the left so a reader scanning
 * the email sees "when" before "what" — the thing that decides whether they
 * read on. Stacks under the text on narrow screens via the class hooks.
 */
function eventCard(event: DigestEvent, siteUrl: string): string {
  const url = event.slug ? `${siteUrl}/events/${encodeURIComponent(event.slug)}` : `${siteUrl}/events`
  const day = fmt(event.startsAt, { day: 'numeric' })
  const month = fmt(event.startsAt, { month: 'short' }).toUpperCase()

  return `
    <tr>
      <td style="padding-bottom:12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FFFFFF;border:1px solid ${CARD_BORDER};border-radius:12px;overflow:hidden;">
          <tr>
            <!-- Date rail -->
            <td class="date-rail" width="84" valign="top" style="width:84px;background-color:${NAVY};padding:20px 12px;text-align:center;">
              <div style="font-family:${FONT};font-size:26px;font-weight:700;color:#FFFFFF;line-height:1.1;">${escapeHtml(day)}</div>
              <div style="font-family:${FONT};font-size:11px;font-weight:700;color:${GOLD};letter-spacing:1.5px;margin-top:2px;">${escapeHtml(month)}</div>
            </td>
            <td valign="top" style="padding:18px 20px;font-family:${FONT};">
              ${event.eventType || event.isNew ? `
                <div style="margin-bottom:8px;">
                  ${event.eventType ? pill(event.eventType, '#F3F4F6', '#4B5563') : ''}
                  ${event.isNew ? `${event.eventType ? '&nbsp;' : ''}${pill('Just announced', '#FDF3DC', '#8A6100')}` : ''}
                </div>
              ` : ''}
              <a href="${url}" target="_blank" style="display:block;font-size:16px;font-weight:700;color:${NAVY};text-decoration:none;line-height:1.35;margin-bottom:6px;">
                ${escapeHtml(event.title)}
              </a>
              <div style="font-size:13px;color:${BODY_TEXT};line-height:1.6;">
                ${escapeHtml(eventWhen(event))}
                ${event.location ? `<br/><span style="color:${MUTED};">${escapeHtml(event.location)}</span>` : ''}
              </div>
              <a href="${url}" target="_blank" style="display:inline-block;margin-top:12px;font-size:13px;font-weight:700;color:${NAVY};text-decoration:none;border-bottom:2px solid ${GOLD};padding-bottom:1px;">
                View&nbsp;details&nbsp;&rarr;
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>`
}

/**
 * News card. Leads with the image where there is one, because the news grid on
 * the site does the same and the digest should feel like the same publication.
 */
function postCard(post: DigestPost, siteUrl: string): string {
  const url = post.slug ? `${siteUrl}/news/${encodeURIComponent(post.slug)}` : `${siteUrl}/news`
  const date = fmt(post.publishedAt, { day: 'numeric', month: 'long', year: 'numeric' })

  return `
    <tr>
      <td style="padding-bottom:12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FFFFFF;border:1px solid ${CARD_BORDER};border-radius:12px;overflow:hidden;">
          ${post.imageUrl ? `
          <tr>
            <td style="padding:0;line-height:0;">
              <a href="${url}" target="_blank" style="display:block;">
                <img src="${escapeHtml(post.imageUrl)}" alt="" width="558" style="display:block;width:100%;max-width:558px;height:auto;border:0;outline:none;text-decoration:none;" />
              </a>
            </td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding:20px;font-family:${FONT};">
              <div style="margin-bottom:10px;">
                ${post.category ? pill(post.category, '#FDF3DC', '#8A6100') : ''}
                <span style="font-size:12px;color:${MUTED};margin-left:${post.category ? '8px' : '0'};">${escapeHtml(date)}</span>
              </div>
              <a href="${url}" target="_blank" style="display:block;font-size:17px;font-weight:700;color:${NAVY};text-decoration:none;line-height:1.35;margin-bottom:8px;">
                ${escapeHtml(post.title)}
              </a>
              ${post.excerpt ? `
                <p style="margin:0 0 12px;font-size:14px;color:${BODY_TEXT};line-height:1.65;">${escapeHtml(post.excerpt)}</p>
              ` : ''}
              ${post.authorName ? `
                <p style="margin:0 0 12px;font-size:12px;color:${MUTED};">By ${escapeHtml(post.authorName)}</p>
              ` : ''}
              <a href="${url}" target="_blank" style="display:inline-block;font-size:13px;font-weight:700;color:${NAVY};text-decoration:none;border-bottom:2px solid ${GOLD};padding-bottom:1px;">
                Read&nbsp;the&nbsp;full&nbsp;story&nbsp;&rarr;
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>`
}

/** Human summary of what's inside — used for the intro line and the subject. */
function summarise(events: DigestEvent[], posts: DigestPost[]): string {
  const parts: string[] = []
  if (events.length) parts.push(`${events.length} upcoming ${events.length === 1 ? 'event' : 'events'}`)
  if (posts.length) parts.push(`${posts.length} new ${posts.length === 1 ? 'post' : 'posts'}`)
  return parts.join(' and ')
}

export interface DigestEmailParams {
  name: string
  frequency: DigestFrequency
  events: DigestEvent[]
  posts: DigestPost[]
  siteUrl: string
  /** Preference centre link, token-scoped so it works without a login. */
  manageUrl: string
  /** One-click opt-out, same token. */
  unsubscribeUrl: string
  /** Overrides "today" — lets the admin preview render a fixed date. */
  issueDate?: Date
}

export function digestEmail(params: DigestEmailParams): { subject: string; html: string; text: string } {
  const { name, frequency, events, posts, siteUrl, manageUrl, unsubscribeUrl } = params
  const issueDate = params.issueDate || new Date()
  const firstName = escapeHtml((name || '').trim().split(' ')[0] || 'there')

  const summary = summarise(events, posts)
  const lead = events[0]?.title || posts[0]?.title || ''

  const subject = lead
    ? `${lead}${events.length + posts.length > 1 ? ` + ${events.length + posts.length - 1} more` : ''} — Dukes' Club round-up`
    : `Your Dukes' Club round-up`

  // Shown in the inbox list next to the subject. The zero-height div after it
  // stops clients from padding the preview out with the alt text that follows.
  const preheader = summary
    ? `${summary.charAt(0).toUpperCase()}${summary.slice(1)} from The Dukes' Club.`
    : 'The latest from The Dukes\' Club.'

  const issueLine = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', day: 'numeric', month: 'long', year: 'numeric',
  }).format(issueDate)

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escapeHtml(EYEBROW[frequency])}</title>
  <style>
    /* Progressive enhancement only — the inline styles above carry the layout. */
    @media only screen and (max-width: 600px) {
      .wrap { padding: 20px 12px !important; }
      .pad { padding-left: 20px !important; padding-right: 20px !important; }
      .date-rail { width: 68px !important; }
      .stack { display: block !important; width: 100% !important; }
    }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${CANVAS};font-family:${FONT};-webkit-font-smoothing:antialiased;">

  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">
    ${escapeHtml(preheader)}
  </div>
  <div style="display:none;max-height:0;overflow:hidden;">
    &#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${CANVAS};">
    <tr>
      <td class="wrap" align="center" style="padding:32px 20px 40px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">

          <!-- Masthead -->
          <tr>
            <td class="pad" style="background-color:${NAVY};border-radius:14px 14px 0 0;padding:34px 40px 30px;text-align:center;">
              <img src="${LOGO_URL}" alt="The Dukes' Club" width="190" style="display:block;margin:0 auto 20px;max-width:190px;height:auto;border:0;" />
              <div style="height:1px;background-color:rgba(229,167,24,0.35);margin:0 0 18px;"></div>
              <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2.4px;color:${GOLD};text-transform:uppercase;">
                ${escapeHtml(EYEBROW[frequency])}
              </p>
              <p style="margin:6px 0 0;font-size:12px;color:rgba(255,255,255,0.55);letter-spacing:0.4px;">
                ${escapeHtml(issueLine)}
              </p>
            </td>
          </tr>

          <!-- Intro -->
          <tr>
            <td class="pad" style="background-color:#FFFFFF;border-left:1px solid ${CARD_BORDER};border-right:1px solid ${CARD_BORDER};border-top:3px solid ${GOLD};padding:30px 40px 4px;">
              <h1 style="margin:0 0 10px;font-size:21px;font-weight:700;color:${NAVY};letter-spacing:-0.3px;">
                Hello ${firstName},
              </h1>
              <p style="margin:0;font-size:15px;color:${BODY_TEXT};line-height:1.7;">
                ${summary
                  ? `Here&rsquo;s what&rsquo;s happening across the network &mdash; ${escapeHtml(summary)} worth a look.`
                  : 'Here&rsquo;s the latest from across the network.'}
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td class="pad" style="background-color:#FFFFFF;border-left:1px solid ${CARD_BORDER};border-right:1px solid ${CARD_BORDER};padding:0 40px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${events.length ? `
                  ${sectionHeading('Upcoming events', events.length)}
                  ${events.map((e) => eventCard(e, siteUrl)).join('')}
                  <tr>
                    <td style="padding:4px 0 0;">
                      <a href="${siteUrl}/events" target="_blank" style="font-family:${FONT};font-size:13px;font-weight:600;color:${MUTED};text-decoration:none;">
                        See the full events calendar &rarr;
                      </a>
                    </td>
                  </tr>
                ` : ''}

                ${posts.length ? `
                  ${sectionHeading('Latest news', posts.length)}
                  ${posts.map((p) => postCard(p, siteUrl)).join('')}
                  <tr>
                    <td style="padding:4px 0 0;">
                      <a href="${siteUrl}/news" target="_blank" style="font-family:${FONT};font-size:13px;font-weight:600;color:${MUTED};text-decoration:none;">
                        Browse all news &rarr;
                      </a>
                    </td>
                  </tr>
                ` : ''}
              </table>
            </td>
          </tr>

          <!-- Members area CTA -->
          <tr>
            <td class="pad" style="background-color:#FFFFFF;border-left:1px solid ${CARD_BORDER};border-right:1px solid ${CARD_BORDER};border-bottom:1px solid ${CARD_BORDER};border-radius:0 0 14px 14px;padding:32px 40px 36px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FAF9F6;border:1px solid ${CARD_BORDER};border-radius:12px;">
                <tr>
                  <td style="padding:24px;text-align:center;font-family:${FONT};">
                    <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:${NAVY};">Your members&rsquo; area</p>
                    <p style="margin:0 0 18px;font-size:13px;color:${MUTED};line-height:1.6;">
                      Video archive, FRCS question bank, fellowship directory and event booking.
                    </p>
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
                      <tr>
                        <td style="background-color:${GOLD};border-radius:8px;">
                          <a href="${siteUrl}/members" target="_blank" style="display:inline-block;padding:13px 30px;font-family:${FONT};font-size:14px;font-weight:700;color:${NAVY};text-decoration:none;letter-spacing:0.3px;">
                            Go to the members&rsquo; area
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="pad" align="center" style="padding:28px 40px 0;font-family:${FONT};">
              <p style="margin:0 0 10px;font-size:12px;color:${MUTED};line-height:1.7;">
                You&rsquo;re receiving this because you have an account with The Dukes&rsquo; Club.<br/>
                ${escapeHtml(CADENCE_DESCRIPTION[frequency])}
              </p>
              <p style="margin:0 0 16px;font-size:12px;line-height:1.7;">
                <a href="${manageUrl}" target="_blank" style="color:${NAVY};font-weight:700;text-decoration:underline;">Choose what you hear about</a>
                <span style="color:#CFCEC9;">&nbsp;&nbsp;|&nbsp;&nbsp;</span>
                <a href="${unsubscribeUrl}" target="_blank" style="color:${MUTED};text-decoration:underline;">Unsubscribe</a>
              </p>
              <p style="margin:0;font-size:11px;color:#B3B7BE;line-height:1.6;">
                &copy; ${issueDate.getFullYear()} The Dukes&rsquo; Club &mdash; ACPGBI Trainee Network<br/>
                <a href="mailto:info@thedukesclub.org.uk" style="color:#B3B7BE;text-decoration:underline;">info@thedukesclub.org.uk</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject, html, text: digestText(params, issueLine) }
}

/**
 * Plain-text alternative. Worth sending: it lifts deliverability, and it is
 * the version screen-reader and text-only clients actually get.
 */
function digestText(params: DigestEmailParams, issueLine: string): string {
  const { name, frequency, events, posts, siteUrl, manageUrl, unsubscribeUrl } = params
  const firstName = (name || '').trim().split(' ')[0] || 'there'
  const lines: string[] = []

  lines.push(`THE DUKES' CLUB — ${EYEBROW[frequency].toUpperCase()}`)
  lines.push(issueLine)
  lines.push('')
  lines.push(`Hello ${firstName},`)
  lines.push('')

  if (events.length) {
    lines.push('UPCOMING EVENTS')
    lines.push('---------------')
    for (const event of events) {
      lines.push(`* ${event.title}${event.isNew ? ' (just announced)' : ''}`)
      lines.push(`  ${eventWhen(event)}${event.location ? ` — ${event.location}` : ''}`)
      lines.push(`  ${event.slug ? `${siteUrl}/events/${encodeURIComponent(event.slug)}` : `${siteUrl}/events`}`)
      lines.push('')
    }
  }

  if (posts.length) {
    lines.push('LATEST NEWS')
    lines.push('-----------')
    for (const post of posts) {
      lines.push(`* ${post.title}`)
      if (post.excerpt) lines.push(`  ${post.excerpt}`)
      lines.push(`  ${post.slug ? `${siteUrl}/news/${encodeURIComponent(post.slug)}` : `${siteUrl}/news`}`)
      lines.push('')
    }
  }

  lines.push(`Members' area: ${siteUrl}/members`)
  lines.push('')
  lines.push('—')
  lines.push(CADENCE_DESCRIPTION[frequency])
  lines.push(`Choose what you hear about: ${manageUrl}`)
  lines.push(`Unsubscribe: ${unsubscribeUrl}`)

  return lines.join('\n')
}
