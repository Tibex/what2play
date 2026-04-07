# Google Ranking Execution Playbook

This playbook documents the parts of the ranking plan that require ongoing execution outside the codebase.

## 1) Search Console Setup Checklist

1. Create or open the Google Search Console property for the production domain.
2. Verify ownership (DNS TXT record recommended).
3. In Search Console, submit sitemap URL:
   - `https://<your-domain>/sitemap.xml`
4. Confirm crawling/indexing signals:
   - No accidental `noindex` on marketing pages.
   - `robots.txt` reachable at `/robots.txt`.
   - Sitemap reachable at `/sitemap.xml`.
5. Review and resolve:
   - Page indexing issues
   - Core Web Vitals and mobile usability reports
   - Crawl anomalies (redirect chains, soft 404, broken internal links)

## 2) Keyword Cluster to Primary Page Map

| Cluster | Primary keyword | Primary page |
| --- | --- | --- |
| Board game night planner | `board game night planner` | `/board-game-night-planner` |
| Board game voting app | `board game voting app` | `/board-game-voting-app` |
| Board game recommendation tool | `board game recommendation tool` | `/board-game-recommendation-tool` |
| BGG collection sync | `BoardGameGeek collection sync` | `/boardgamegeek-collection-sync` |
| Planning guide | `how to plan a board game night` | `/how-to-plan-a-board-game-night` |

Hub page for internal linking:
- `/resources`

Supplemental feature-intent page:
- `/faq` (availability polling and collection performance insight queries)

## 3) Weekly Measurement Cadence

Every week, review these metrics by landing page and query:

- Impressions
- Clicks
- CTR
- Average position
- Indexed page count
- Conversion rate from organic landing pages

## 4) Iteration Rule (Positions 4-20 First)

Prioritize pages/queries ranking in positions `4-20` and iterate every `2-4` weeks:

1. Tighten intent match in opening copy.
2. Improve title/meta for higher CTR.
3. Expand useful depth (examples, comparisons, FAQs).
4. Add/refresh internal links from relevant pages.
5. Re-check structured data validity.

## 5) Authority Building (Ongoing)

Target editorially-earned links from relevant sites:

- Partnerships with board game communities and clubs
- Original data posts (recommendation trends, voting outcomes)
- Useful tools/checklists people reference naturally
- Guest contributions in adjacent tabletop communities

Avoid:

- Purchased low-quality links
- Spammy directory campaigns
- Thin AI-only pages with no unique value

