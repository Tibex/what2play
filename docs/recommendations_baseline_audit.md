# Recommendations Baseline Audit

This document captures the current recommendation engine baseline before V2 tuning.

## Current Score Weights

From `backend/src/recommendations/recommendations.service.ts`:

- `base`: 40
- `groupRating`: 20
- `bggRating`: 10
- `timeFit`: 16
- `history`: 14
- `attendeeHistory`: 14
- `freshness` penalty: -8
- `complexityFit`: 10
- `bggBestPlayersFit`: 8

## Feature Coverage Baseline

- Constraints:
  - hard player-count bounds (`minPlayers <= going <= maxPlayers`)
  - hard BGG poll exclusion when not-recommended >= 60%
- Positive ranking signals:
  - attendee average ratings for owned games
  - global BGG rating
  - duration fit against event duration
  - global historical feedback (enjoyment + completion)
  - attendee-only feedback (enjoyment + play rate)
  - preferred complexity fit (`preferredWeight`)
  - BGG player-count best/recommended poll fit
- Negative ranking signals:
  - freshness penalty if recently played in last 30 days
- Discovery fallback:
  - external discovery candidates by compatibility + BGG score
  - capped below strongest owned candidate in fallback mode

## Known Gaps Baseline

- Group average can hide strong individual dislikes.
- No explicit diversity reranking objective in final top list.
- Cold start relies strongly on BGG/popularity signals.
- Confidence is based on signal presence, not sample reliability.
- No dedicated recommendation telemetry stream for offline tuning.

## Baseline Evaluation Queries

These metrics can be computed from existing event/candidate/vote/feedback data.

1. Recommendation to top-3 vote conversion:
   - Among generated candidates, fraction that land in user submitted top-3 ballots.
2. Recommendation to played conversion:
   - Fraction of recommended candidates that appear in event feedback as played.
3. Played to liked conversion:
   - Fraction of recommended-and-played games with `enjoymentRating >= 4`.
4. Recommendation rejection proxy:
   - Manual removal rate from recommendation list during planning.

## Baseline Acceptance Targets for V2

- Increase top-3 vote conversion.
- Increase recommended-and-played rate.
- Increase liked-after-play rate.
- Decrease manual removals.

## First Tuning Pass (V2 Seed Parameters)

Initial V2 seed parameters introduced for validation:

- Sample-size shrinkage:
  - feedback pivot: `6`
  - attendee feedback pivot: `4`
  - BGG poll pivot: `80`
- Group fairness:
  - least-misery penalty weight: `14`
  - explicit dislike penalty weight: `8`
- Personalization:
  - affinity fit weight (mechanics/categories from likes/dislikes): `10`
  - preferred duration fit weight: `8`
- Discovery cold start:
  - archetype fit weight: `12`
- Diversity rerank:
  - candidate pool considered: top `30`
  - exploration slots in final set: `2`
  - MMR blend: relevance `0.78`, diversity penalty coefficient `12`
