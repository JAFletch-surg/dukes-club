/* ══════════════════════════════════════════════════════════════════
   EVENT DISPLAY — the shared wording for prices and card summaries

   Cards, the calendar and the event page all need the same two
   answers: what does this cost, and what is the one-line pitch? Both
   live here so a deposit reads as a deposit everywhere, and so a tile
   never spills the whole description onto the listing page again.
   ══════════════════════════════════════════════════════════════════ */

/** Longest summary an admin can store — roughly one line on a card. */
export const EVENT_SUMMARY_MAX_LENGTH = 160

/** How a deposit is described wherever the price appears. */
export const REFUNDABLE_DEPOSIT_LABEL = 'refundable deposit'

type PriceFields = {
  price_pence?: number | null
  member_price_pence?: number | null
  price_is_refundable_deposit?: boolean | null
}

type SummaryFields = {
  summary?: string | null
  description_plain?: string | null
}

/** "£150", "£12.50", or "Free" for nothing/zero. */
export function formatPrice(pence: number | null | undefined): string {
  if (!pence || pence === 0) return 'Free'
  return `£${(pence / 100).toFixed(pence % 100 === 0 ? 0 : 2)}`
}

/** True when this event's price is a deposit rather than a fee. */
export function isRefundableDeposit(event: PriceFields): boolean {
  return !!event.price_is_refundable_deposit && (event.price_pence || 0) > 0
}

/** The headline price on its own: "£150" or "£150 refundable deposit". */
export function formatEventPrice(event: PriceFields): string {
  const price = formatPrice(event.price_pence)
  return isRefundableDeposit(event) ? `${price} ${REFUNDABLE_DEPOSIT_LABEL}` : price
}

/**
 * The price as a card shows it — headline plus the member rate when it
 * differs: "£150 refundable deposit (£100 members)".
 */
export function formatEventPriceWithMember(event: PriceFields): string {
  const base = formatEventPrice(event)
  const member = event.member_price_pence
  if (member == null || member === event.price_pence) return base
  return `${base} (${formatPrice(member)} members)`
}

/** Collapse whitespace so a summary always occupies a single line. */
function flatten(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** Cut at a word boundary and mark the cut with an ellipsis. */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  const cut = text.slice(0, maxLength - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > maxLength - 30 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

/**
 * The one-line pitch for a tile. Uses the admin's summary when there is
 * one; otherwise falls back to the opening of the description so events
 * written before summaries existed still read sensibly.
 */
export function eventSummary(
  event: SummaryFields,
  maxLength = EVENT_SUMMARY_MAX_LENGTH
): string {
  const explicit = flatten(event.summary || '')
  if (explicit) return truncate(explicit, maxLength)
  return truncate(flatten(event.description_plain || ''), maxLength)
}
