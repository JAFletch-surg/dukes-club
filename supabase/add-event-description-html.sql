-- ═══════════════════════════════════════════════════════════════════
-- Event descriptions: HTML alongside plain text
--
-- The admin event form now accepts HTML segments in the description
-- free text. The rendered markup lives in description_html; the
-- existing description_plain keeps holding a tag-free copy, which is
-- what the event cards, webinar list and search still read.
--
-- Run this before deploying — the admin form writes description_html
-- on every save and PostgREST rejects the write if the column is
-- missing. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

alter table public.events
  add column if not exists description_html text;

comment on column public.events.description_html is
  'Sanitised HTML for the event page. description_plain holds the tag-free copy used by listings and search.';

-- Backfill: wrap each existing plain-text paragraph in <p>, escaping the
-- three characters that would otherwise be read as markup. Only touches
-- rows that have not been given HTML yet.
update public.events
set description_html =
  '<p>' ||
  replace(
    replace(
      replace(
        replace(
          replace(btrim(description_plain), '&', '&amp;'),
          '<', '&lt;'
        ),
        '>', '&gt;'
      ),
      E'\n\n', '</p><p>'
    ),
    E'\n', '<br />'
  ) ||
  '</p>'
where description_html is null
  and description_plain is not null
  and btrim(description_plain) <> '';
