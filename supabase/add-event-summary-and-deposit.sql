-- ═══════════════════════════════════════════════════════════════════
-- Events: one-line card summary + refundable-deposit pricing
--
--   summary                      the single line shown on event tiles,
--                                so the cards stop spilling the whole
--                                description onto the listing page
--   price_is_refundable_deposit  marks price_pence as a deposit that is
--                                refunded on attendance, which the
--                                cards and event page label as such
--
-- Run this before deploying — the admin event form writes both columns
-- on every save. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

alter table public.events
  add column if not exists summary text;

alter table public.events
  add column if not exists price_is_refundable_deposit boolean not null default false;

comment on column public.events.summary is
  'One-line summary for event cards and listings. Falls back to a truncated description_plain when blank.';

comment on column public.events.price_is_refundable_deposit is
  'True when price_pence is a deposit refunded on attendance — listings render it as "£150 refundable deposit".';

-- Backfill: seed each existing event with the opening of its description,
-- collapsed to one line and cut at a word boundary. Only touches rows that
-- have not been given a summary yet, so re-running never overwrites an
-- admin's wording.
update public.events ev
set summary = case
    when length(src.flat) <= 160 then src.flat
    else regexp_replace(left(src.flat, 159), '\s\S*$', '') || '…'
  end
from (
  select id, regexp_replace(btrim(description_plain), '\s+', ' ', 'g') as flat
  from public.events
  where summary is null
    and description_plain is not null
    and btrim(description_plain) <> ''
) src
where ev.id = src.id
  and src.flat <> '';
