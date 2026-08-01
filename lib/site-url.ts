/**
 * Single source of truth for the club's public URL.
 *
 * The site moved from dukesclub.org to thedukesclub.org.uk. Because
 * NEXT_PUBLIC_SITE_URL is inlined at build time, a stale value in the hosting
 * dashboard silently bakes the dead domain into every email link. Anything
 * pointing at a retired host is rewritten to the canonical URL rather than
 * trusted.
 */

export const CANONICAL_SITE_URL = 'https://www.thedukesclub.org.uk'

export const CANONICAL_HOST = 'www.thedukesclub.org.uk'

/** Hosts the club has since moved away from. */
export const LEGACY_HOSTS = new Set([
  'dukesclub.org',
  'www.dukesclub.org',
  'dukesclub.org.uk',
  'www.dukesclub.org.uk',
])

function resolveSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (!configured) return CANONICAL_SITE_URL

  const withoutTrailingSlash = configured.replace(/\/+$/, '')

  let url: URL
  try {
    url = new URL(withoutTrailingSlash)
  } catch {
    console.warn(
      `[site-url] NEXT_PUBLIC_SITE_URL is not a valid URL (${configured}); using ${CANONICAL_SITE_URL}`
    )
    return CANONICAL_SITE_URL
  }

  if (LEGACY_HOSTS.has(url.host.toLowerCase())) {
    console.warn(
      `[site-url] NEXT_PUBLIC_SITE_URL points at the retired domain ${url.host}; using ${CANONICAL_SITE_URL}`
    )
    return CANONICAL_SITE_URL
  }

  // Anything else (localhost, preview deployments) is used as given.
  return withoutTrailingSlash
}

export const SITE_URL = resolveSiteUrl()
