# Recommendations Baseline Audit

This document captures the current recommendation engine baseline before V2 tuning.

## Current Score Weights

From `backend/src/recommendations/recommendations.service.ts`:

- `base`: 40
- `groupRating`: 20
- `bggRating`: 16
- `bggConsensus`: 8
- `timeFit`: 16
- `preferredDurationFit`: 8
- `history`: 14
- `attendeeHistory`: 14
- `freshness` penalty: -8
- `complexityFit`: 10
- `bggBestPlayersFit`: 8
- `leastMiseryPenalty`: -14
- `dislikePenalty`: -8
- `affinityFit`: 10
- `discoveryArchetypeFit`: 12

## Feature Coverage Baseline

- Constraints:
  - hard player-count bounds (`minPlayers <= going <= maxPlayers`)
  - hard BGG poll exclusion when not-recommended >= 60%
- Positive ranking signals:
  - attendee average ratings for owned games (with sample shrinkage)
  - global BGG rating
  - BGG recommendation-consensus signal
  - duration fit against event duration budget
  - duration fit against attendee preferred duration profile
  - global historical feedback (enjoyment + completion)
  - attendee-only feedback (enjoyment + play rate)
  - preferred complexity fit (`preferredWeight`)
  - BGG player-count best/recommended poll fit
  - affinity fit from liked/disliked mechanics/categories
  - cold-start discovery archetype fit
- Negative ranking signals:
  - freshness penalty if recently played in last 30 days
  - least-misery guardrail (penalizes options with strong individual mismatch)
  - explicit dislike-rate penalty from attendee feedback
  - low best-player-vote dampener when BGG poll support is weak
- Discovery fallback:
  - external discovery candidates by compatibility + BGG quality
  - capped below strongest owned candidate when not in discovery mode
- Diversity rerank:
  - MMR rerank over top-30 pool (`relevance * 0.78 - similarity * 12`)
  - final exploration slots: `2`

## Known Gaps Baseline

- Weight configuration is still hardcoded in service constants.
- Confidence is based on signal presence/sample size heuristics, not calibrated reliability.
- Similarity/diversity currently relies on hand-built heuristics rather than learned embeddings.
- No dedicated recommendation telemetry dashboard for continuous offline tuning loops.

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
  - affinity fit weight: `10`
  - preferred duration fit weight: `8`
- Discovery cold start:
  - archetype fit weight: `12`
- Best-player guardrail:
  - dampener threshold: `0.10`
  - dampener factor: `0.78`
- Diversity rerank:
  - candidate pool considered: top `30`
  - exploration slots in final set: `2`
  - MMR blend: relevance `0.78`, diversity penalty coefficient `12`
