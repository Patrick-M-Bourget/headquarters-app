# Funnel export (until the funnel analyst has read-only keys)

The funnel analyst (`runners/marketing/funnel.ts`) reads one CSV of **aggregate counts**: `week,step,dim,value,count`. No row may identify a person; the loader refuses columns like `email`, `name`, `ip`, `customer`, `install_id`, `token` or values containing `@`.

Save it as `prototype/research/marketing/funnel/<monday>.csv`. That folder is git-ignored: sales and signup numbers never go into the public repo. Then run:

```
cd prototype && node --env-file=.env runners/marketing/funnel.ts research/marketing/funnel/2026-11-09.csv
```

`week` is the Monday of the ISO week (`date_trunc('week', …)` in Postgres gives that).

## 1. Signups, purchases and app events (Supabase prod, SQL editor, read-only query)

```sql
with s as (
  select date_trunc('week', created_at)::date as week, lang,
         coalesce(filling, 'none') as filling,
         coalesce(utm_source, 'none') as utm_source,
         coalesce(utm_campaign, 'none') as utm_campaign
  from public.signups
), p as (
  select date_trunc('week', created_at)::date as week, lang
  from public.licenses where source = 'stripe' and stripe_session_id like 'cs_live_%'
)
select week, 'signups' as step, 'all' as dim, 'all' as value, count(*) from s group by week
union all select week, 'signups', 'lang', lang, count(*) from s group by week, lang
union all select week, 'signups', 'filling', filling, count(*) from s group by week, filling
union all select week, 'signups', 'utm_source', utm_source, count(*) from s group by week, utm_source
union all select week, 'signups', 'utm_campaign', utm_campaign, count(*) from s group by week, utm_campaign
union all select week, 'purchases', 'all', 'all', count(*) from p group by week
union all select week, 'purchases', 'lang', lang, count(*) from p group by week, lang
union all select date_trunc('week', received_at)::date,
  case event when 'first_launch' then 'first_launch' when 'first_scan_completed' then 'first_scan' else 'first_cleanup' end,
  'all', 'all', count(*) from public.telemetry_events group by 1, 2
order by 1, 2, 3, 4;
```

Export the result as CSV and keep the header `week,step,dim,value,count` (rename the last column if the editor calls it `count(*)`).

Notes:
- `signups.created_at` is the first request; a repeat request from the same email updates the row, so this counts new people.
- Comped licenses (`source = 'comp'`) and test-mode sessions are left out of purchases.
- App events come only from people who turned on "Share setup progress" (off by default), so they undercount.
- `download_starts` is a running counter per release (`public.releases`), not per week. Add a row `<week>,download_starts,all,all,<this week's counter minus last week's>` by hand, or leave it out.

## 2. Visitors (Vercel Web Analytics)

From the project's Analytics tab for the same week: add `<week>,visitors,all,all,<visitors>`, and per language `<week>,visitors,lang,en,<visitors on pages not under /fr/>` / `…,lang,fr,…`. Page rows (`dim` = `page`, value = the path) are optional.

## Later: read-only keys (owner, L3)

Replacing this file with direct reads needs a Supabase read-only role limited to these aggregates (a view, no email column), a Vercel token with analytics read, and a Stripe restricted key with read on Checkout Sessions. The owner creates them; they live only in `prototype/.env`.
