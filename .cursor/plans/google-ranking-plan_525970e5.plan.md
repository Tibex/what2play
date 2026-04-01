---
name: google-ranking-plan
overview: Improve Google rankings by focusing on technical crawlability, high-intent content, authority building, and ongoing measurement.
todos:
  - id: setup-search-console
    content: Set up/verify Google Search Console and submit sitemap; resolve indexing blockers.
    status: in_progress
  - id: keyword-cluster-map
    content: Map 5-10 high-intent keyword clusters and assign one primary page per cluster.
    status: completed
  - id: content-and-onpage
    content: Publish or optimize pages for intent match, titles, headings, and unique value.
    status: completed
  - id: internal-linking-hubs
    content: Implement topic hubs and strategic internal linking to priority pages.
    status: completed
  - id: schema-and-serp
    content: Add and validate structured data for eligible pages to improve SERP visibility.
    status: completed
  - id: authority-and-iteration
    content: Run weekly link earning + performance review and iterate pages ranking in positions 4-20.
    status: in_progress
isProject: false
---

# Get To Top Google Results

## Reality Check

- There is no guaranteed "#1" shortcut.
- You win by being better than competing pages for a specific query cluster.
- The fastest results usually come from long-tail, high-intent keywords first.

## Priority 1: Technical Foundations (Week 1)

- Ensure pages are indexable (`200` status, no accidental `noindex`, robots not blocking key pages).
- Submit and monitor XML sitemap in Google Search Console.
- Fix crawl errors, redirect chains, duplicate canonicals, and broken internal links.
- Improve page speed and UX (especially mobile).

## Priority 2: Search Intent + Content (Weeks 1-4)

- Build keyword clusters around user intent (informational, comparison, transactional).
- Create one strong page per primary intent; avoid overlapping pages targeting the same keyword.
- Use clear titles, meta descriptions, H1/H2 structure, and helpful on-page copy.
- Add unique value competitors don’t provide (original data, deep comparisons, tools, examples).

## Priority 3: Topical Authority + Internal Linking (Weeks 2-6)

- Create topic hubs (pillar page + supporting articles).
- Internally link support pages to primary money/conversion pages with descriptive anchors.
- Keep navigation and URL structure simple so Google can discover related pages.

## Priority 4: SERP Enhancements (Weeks 2-6)

- Add valid structured data where relevant (e.g., FAQ, Product, Review, Article, Breadcrumb).
- Validate with Rich Results Test and fix all required-property errors.
- Write compelling titles/meta to increase CTR; iterate based on Search Console query-level CTR.

## Priority 5: Authority Signals (Ongoing)

- Earn links from relevant, trusted websites (digital PR, partnerships, useful tools/resources).
- Avoid spammy link schemes; prioritize editorially earned links.
- Strengthen E-E-A-T signals: clear author/company info, transparent policies, updated content.

## Measurement Cadence (Weekly)

- Track: impressions, clicks, CTR, average position, indexed pages, conversion rate by landing page.
- Re-optimize underperforming pages every 2-4 weeks (content depth, intent match, title/meta, linking).
- Double down on pages ranking positions 4-20 first; these usually move fastest.

## 90-Day Execution Target

- Publish/upgrade 20-40 intent-matched pages.
- Acquire 10-30 quality referring domains (niche dependent).
- Improve Core Web Vitals and mobile usability on all key landing pages.
- Lift non-brand organic clicks and conversions month-over-month.

## Quick "Do Not Do" List

- Don’t buy low-quality links.
- Don’t create thin AI-only pages with no unique value.
- Don’t target broad, ultra-competitive head terms first.
- Don’t ignore search intent mismatch (biggest reason pages stall).

## Implementation Status (April 1, 2026)

- Completed in code:
  - Added technical SEO foundations: richer metadata, `robots.txt`, `sitemap.xml`.
  - Added 5 keyword-cluster landing pages plus a `/resources` hub page.
  - Added internal links from homepage and between cluster pages.
  - Added JSON-LD structured data for homepage and resource pages.
  - Added crawl controls (`noindex`) for non-marketing/authenticated sections.
- Remaining manual/ongoing actions:
  - Verify Search Console property and submit sitemap in production.
  - Run weekly review and iteration loop (positions 4-20 first).
  - Execute ongoing link-earning campaigns.
- Operations playbook:
  - `docs/seo-google-ranking-playbook.md`
