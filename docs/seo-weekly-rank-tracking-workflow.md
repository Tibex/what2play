# SEO Weekly Rank Tracking Workflow (Google Search Console)

Use this workflow to track true Google query positions for the target keyword set.

## Files

- Tracker data: `docs/seo-query-rank-tracker.csv`
- Query list source: `docs/google-top20-target-searches.md`
- Automation script: `scripts/seo-rank-tracker.mjs`

## Automated Update Command

After exporting CSV from Search Console, run:

`npm run seo:rank-report -- --export <path-to-gsc-export.csv> --date YYYY-MM-DD`

Example:

`npm run seo:rank-report -- --export ~/Downloads/search-console-queries.csv --date 2026-04-07`

The command:

- updates `docs/seo-query-rank-tracker.csv` for that date
- writes a weekly summary to `docs/seo-weekly-report-YYYY-MM-DD.md`

## Weekly Steps (15-20 minutes)

1. Open Google Search Console for `https://what2play.games/`.
2. Go to **Performance > Search results**.
3. Set date range to **Last 7 days** (or a fixed Monday-Sunday window).
4. Enable metrics: **Clicks**, **Impressions**, **CTR**, **Average position**.
5. Add filter:
   - **Queries** -> **Custom (regex)** -> paste:
     - `board game night planner|online board game night planner|board game voting app|app to vote on board games|board game recommendation tool|what board game should we play tool|BoardGameGeek collection sync|sync BoardGameGeek collection with app|how to plan a board game night|board game night planning checklist|board game availability poll|poll dates for game night|track board game ratings after game night|which board games get picked most|best board game night planner|board game vote app for groups|board game recommender for groups|BoardGameGeek game night planner|how to host a board game night|board game night organizer app|choose a board game for group size|board game collection stats|tabletop game night planner|board game night resources|board game planner|board game app|board game recommendations`
6. Export the table (**Export > Google Sheets/CSV**).
7. For each query in `docs/seo-query-rank-tracker.csv`, add a new row with:
   - `date`
   - `avg_position`
   - `clicks`
   - `impressions`
   - `ctr`
   - `top_20_status`:
     - `yes` if `avg_position <= 20`
     - `no` if `avg_position > 20`
     - `unknown` if query not present in export
8. Sort/report:
   - Wins: queries that moved into `top_20_status = yes`
   - Near wins: `avg_position` between 20 and 30
   - Priority fixes: highest-impression queries with `avg_position > 20`

## Weekly Report Template

Copy this into your status update each week:

```md
## SEO Top-20 Weekly Report (YYYY-MM-DD)

- Queries in top 20: X / 28
- New entries into top 20 this week: <list>
- Biggest movers (position gain): <list>
- High-impression queries still outside top 20: <list>
- Pages to iterate next (positions 4-20 first): <list>
```

## Iteration Rule

When a query is between positions 4-20, prioritize:

1. Improve intro copy for intent match.
2. Improve title/meta for CTR.
3. Add depth (examples/FAQs/comparisons).
4. Add internal links from `/resources` and related pages.
