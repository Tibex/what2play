# SEO Weekly Rank Tracking Workflow (Google Search Console)

Use this workflow to track true Google query positions for the target keyword set.

## Files

- Tracker data: `docs/seo-query-rank-tracker.csv`
- Query list source: `docs/google-top20-target-searches.md`
- Automation script: `scripts/seo-rank-tracker.mjs`
- Weekly rank output: `docs/seo-weekly-report-YYYY-MM-DD.md`
- Weekly execution output: `docs/seo-action-plan-YYYY-MM-DD.md`
- Reusable execution template: `docs/seo-next-7-days-template.md`

## Automated Update Command

After exporting CSV from Search Console, run:

`npm run seo:rank-report -- --export <path-to-gsc-export.csv> --date YYYY-MM-DD`

Example:

`npm run seo:rank-report -- --export ~/Downloads/search-console-queries.csv --date 2026-04-07`

The command:

- updates `docs/seo-query-rank-tracker.csv` for that date
- writes a weekly summary to `docs/seo-weekly-report-YYYY-MM-DD.md`
- writes a weekly execution sheet to `docs/seo-action-plan-YYYY-MM-DD.md`

## Weekly Steps (15-20 minutes)

1. Open Google Search Console for `https://what2play.games/`.
2. Go to **Performance > Search results**.
3. Set date range to **Last 7 days** (or a fixed Monday-Sunday window).
4. Enable metrics: **Clicks**, **Impressions**, **CTR**, **Average position**.
5. Add filter:
   - **Queries** -> **Custom (regex)** -> paste:
     - `board game night planner|online board game night planner|board game voting app|app to vote on board games|board game recommendation tool|what board game should we play tool|BoardGameGeek collection sync|sync BoardGameGeek collection with app|how to plan a board game night|board game night planning checklist|board game availability poll|poll dates for game night|track board game ratings after game night|which board games get picked most|best board game night planner|board game vote app for groups|board game recommender for groups|BoardGameGeek game night planner|how to host a board game night|board game night organizer app|choose a board game for group size|board game collection stats|tabletop game night planner|board game night resources|board game planner|board game app|board game recommendations`
6. Export the table (**Export > Google Sheets/CSV**).
7. Run the script command from this page. The script now handles:
   - replacing that date's rows in `docs/seo-query-rank-tracker.csv`
   - mapping top-20 status (`yes`, `no`, `unknown`)
   - rank coverage summary (`matched queries / tracked queries`)
   - opportunity scoring and recommended action type
8. Review `docs/seo-weekly-report-YYYY-MM-DD.md`:
   - wins and near wins
   - high-impression terms outside top 20
   - **Top SEO Opportunities This Week**
9. Execute from `docs/seo-action-plan-YYYY-MM-DD.md`:
   - top priorities (top 5-7)
   - fast wins (title/meta/internal links)
   - deeper tasks (intro intent/content depth)
   - carry-over items from previous week
10. Copy relevant items into `docs/seo-next-7-days-template.md` for planning and owner assignment.

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

## New Weekly Execution Loop

1. Export GSC query data.
2. Run:
   - `npm run seo:rank-report -- --export <path-to-gsc-export.csv> --date YYYY-MM-DD`
3. Open generated files:
   - `docs/seo-weekly-report-YYYY-MM-DD.md`
   - `docs/seo-action-plan-YYYY-MM-DD.md`
4. Move top tasks into `docs/seo-next-7-days-template.md`.
5. End of week: re-run and compare:
   - top-20 count
   - near wins count
   - coverage %
   - carry-over reduction
