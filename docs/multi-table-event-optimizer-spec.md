# Multi-Table Event Optimizer Spec (V1)

## Goal

Define an optional event mode that helps hosts run board game cafe/club events with multiple tables and multiple candidate games by automatically proposing player-to-table-and-game assignments.

V1 objective is **balanced optimization**:

1. Seat as many attendees as possible.
2. Among valid seatings, maximize preference and fit quality.

This mode is host-assisted, explainable, and override-friendly (host can lock/adjust/rerun).

## Why This Exists

Single-game event flows do not solve common organizer pain in larger sessions:

- Different games have different player-count constraints.
- Players have different weight/time/game preferences.
- Table count is limited.
- Some attendees arrive late, leave early, or cancel.
- Manual assignment takes too long and can feel unfair.

The optimizer reduces setup friction and improves fairness while keeping host control.

## Product Scope (V1)

### In Scope

- New optional event mode: `multi_table_optimizer`.
- Host configures:
  - available tables for this event run
  - candidate games pool
  - attendee list (from RSVPs) and optional attendance status changes
  - optional player preferences and hard exclusions
- System proposes assignment:
  - which games run
  - which table each game uses
  - which players sit at each table/game
  - who remains unseated (if unavoidable), with reason
- Explainability for each table assignment and each unseated player.
- Host tools:
  - lock a table/game/player assignment
  - manually move players
  - rerun optimizer with locks preserved

### Out of Scope (V1)

- Fully autonomous live reshuffling during play.
- Skill/ELO balancing for competitive tournaments.
- Payments/ticketing/seat sales.
- Native mobile-first redesign (use existing responsive web flows).

## User Stories

### Host

- As a host, I can select games and tables and receive a valid proposal in seconds.
- As a host, I can prioritize seating everyone even if preference fit is imperfect.
- As a host, I can lock specific assignments (friends together, teach table, etc.) before rerun.
- As a host, I can see why players were assigned/unseated.

### Player

- As a player, I can provide preference signals (games, complexity, duration).
- As a player, I can see where I was assigned and why.
- As a player, I can see transparent fallback behavior if no seat is available.

## Domain Terms

- **Assignment run**: one optimizer execution for an event snapshot.
- **Table slot**: a physical table that can host one game in this run.
- **Seed game**: a selected game used to initialize a table before local improvements.
- **Lock**: host-enforced fixed decision (table-game pair or player seat).

## Inputs

### Required

- Event ID and confirmed attendee set.
- Active table count (integer > 0).
- Candidate games set with min/max player count.

### Optional

- Player game preferences (ranked list or likes/dislikes).
- Preferred complexity band.
- Preferred session duration band.
- Friend-with/friend-avoid constraints.
- Teaching-required flag (new players grouped with at least one experienced player).
- Hard exclusions:
  - player cannot play game X
  - player cannot sit with player Y
  - table unavailable

## Hard Constraints

Must always hold in generated assignments:

1. A player is assigned to at most one table.
2. A table runs at most one game.
3. Players assigned to a game must satisfy that game's min/max players.
4. Locked assignments are never violated.
5. Hard exclusion constraints are never violated.

If no full feasible assignment exists, solver returns best feasible partial assignment and unseated players.

## Soft Constraints and Scoring

Optimization is lexicographic:

1. Maximize seated players.
2. Maximize total assignment score.

### Per Player-to-Game Fit Components

Normalize each component to `[0,1]`:

- `gamePreferenceFit`: player interest in game.
- `complexityFit`: closeness between player preferred complexity and game complexity.
- `durationFit`: closeness between player preferred duration and estimated event duration budget.
- `socialFit`: positive friend-with edges and negative avoid edges.
- `experienceFit`: optional boost for at least one experienced player at complex tables.

Weighted fit:

`fit(p,g) = wPref*gamePreferenceFit + wComplexity*complexityFit + wDuration*durationFit + wSocial*socialFit + wExperience*experienceFit`

Default V1 weights:

- `wPref = 0.40`
- `wComplexity = 0.20`
- `wDuration = 0.20`
- `wSocial = 0.15`
- `wExperience = 0.05`

### Global Objective

Let `SeatedCount` be seated attendees and `ScoreSum` total fit across seated attendees.

Use lexicographic objective equivalent:

`Objective = BIG_M * SeatedCount + ScoreSum`

Where `BIG_M` is larger than max possible `ScoreSum` change from one seat difference, ensuring seat coverage dominates.

## Assignment Algorithm (V1)

V1 uses a deterministic heuristic with local improvements for speed and explainability.

### Step 0: Preprocess

- Filter candidate games incompatible with event constraints.
- Build compatibility matrix `eligible(player, game)`.
- Apply locks into fixed partial assignment.
- Remove impossible players/games early with reason tags.

### Step 1: Seed Tables

- Pick up to `tableCount` seed games from candidates using a game utility score:
  - high aggregate preference among unassigned eligible players
  - good min/max fit for current attendee count
  - diversity penalty against near-duplicate options if desired

### Step 2: Initial Fill (Greedy)

- For each seeded table, assign players greedily by highest marginal fit while preserving ability to satisfy remaining game minima.
- If a seeded game cannot reach `minPlayers`, drop or swap it and retry.

### Step 3: Local Improvement

Perform bounded iterations until no gain or iteration cap:

- one-player moves (table A -> B)
- pair swaps (A <-> B)
- game swap at a table (replace game with reserve candidate)
- open/close table if beneficial and valid

Accept only objective-improving moves respecting hard constraints.

### Step 4: Finalize and Explain

- Produce final assignment with score breakdown per player.
- Mark unseated players with dominant reason:
  - no eligible game
  - table capacity reached
  - lock/exclusion constraints

### Determinism

- Use stable tie-breakers (player ID, game ID, table index).
- Optional `seed` parameter for reproducible debug/test runs.

### Complexity and Performance Target

- Target <= 2 seconds for 60 attendees, 12 tables, 80 candidate games.
- Hard timeout (for example 3 seconds) falls back to best-so-far feasible solution.

## Rerun and Lock Behavior

### Rerun Triggers

- Host changes game pool, table count, locks, or attendee status.
- System detects significant RSVP changes.

### Preservation Rules

- Locked assignments remain immutable across reruns.
- Manual host moves become implicit locks unless host marks them temporary.

### Conflict Handling

- If lock set becomes infeasible (for example too many locked players for a game max):
  - return validation error before run
  - surface exact conflicting lock IDs

## API Contract (Proposed)

Base path examples use `/api/events/:eventId/multi-table`.

### Create/Update Optimizer Config

- `PUT /config`
- Body:
  - `mode: "multi_table_optimizer"`
  - `tableCount`
  - `candidateGameIds[]`
  - optional weight overrides
  - optional constraints
- Returns stored config + validation warnings.

### Run Optimizer

- `POST /runs`
- Body:
  - optional `preserveManualLocks: boolean`
  - optional `seed: number`
- Returns:
  - `runId`
  - assignment payload
  - `seatedCount`, `unseatedCount`
  - objective summary
  - explainability artifacts
  - warnings/errors

### Get Run

- `GET /runs/:runId`
- Returns full run snapshot and audit metadata.

### Apply Host Manual Edit

- `POST /runs/:runId/manual-edits`
- Body:
  - move player
  - set/remove lock
  - change table game
- Returns updated draft state (can be committed or rerun).

### Commit Assignment

- `POST /runs/:runId/commit`
- Persists selected run as event's active seating plan.

### Explain Player Assignment

- `GET /runs/:runId/players/:playerId/explanation`
- Returns component breakdown + alternative near-best options.

## Data Model Additions (Proposed)

Keep compatibility with existing event/voting data by introducing optional entities.

- `event_optimizer_configs`
  - `event_id` (unique)
  - `mode`
  - `table_count`
  - `weights_json`
  - `constraints_json`
  - timestamps
- `event_optimizer_runs`
  - `id`
  - `event_id`
  - `config_snapshot_json`
  - `objective_value`
  - `seated_count`
  - `status` (`success`, `partial`, `failed`, `timeout`)
  - `warnings_json`
  - timestamps
- `event_optimizer_run_tables`
  - `run_id`
  - `table_index`
  - `game_id`
  - `locked`
- `event_optimizer_run_seats`
  - `run_id`
  - `table_index`
  - `player_id`
  - `fit_score`
  - `score_breakdown_json`
  - `locked`
- `event_optimizer_run_unseated`
  - `run_id`
  - `player_id`
  - `reason_code`

## UX Flow (Host)

1. Host enables multi-table mode during event setup or from event controls.
2. Host chooses available tables and candidate games.
3. Host reviews optional constraints/preferences and clicks "Generate plan".
4. System shows proposed layout:
   - table cards (game + seated players)
   - unseated list with reasons
   - confidence/explainability badges
5. Host may lock, move players, change a table game, then rerun.
6. Host commits final plan; players see assignments.

## Explainability Requirements

- Every player assignment exposes top 2-3 contributing factors.
- Unseated reason must be explicit and non-ambiguous.
- Host sees "what changed" diff after rerun.

## Telemetry and Metrics

Track:

- `optimizer_run_started`
- `optimizer_run_completed`
- `optimizer_run_failed`
- `optimizer_manual_edit_applied`
- `optimizer_assignment_committed`

Core KPIs:

- Seat coverage rate (`seated / attending`).
- Avg fit score among seated players.
- Host time-to-commit assignment.
- Manual edit count per run (lower is better after quality improves).
- Assignment stability across reruns (churn percentage).
- Post-event satisfaction deltas for seated players.

## Validation and Testing

### Unit

- Fit component normalization.
- Hard-constraint validator.
- Objective comparison (lexicographic behavior).

### Integration

- End-to-end run lifecycle (`config -> run -> manual edit -> commit`).
- Lock preservation across reruns.
- Infeasible lock conflict reporting.

### Scenario/Simulation

- Synthetic event simulations across attendance sizes and preference distributions.
- Regression suite with fixed random seeds for deterministic snapshots.

## Rollout Plan

### Phase 1: Internal Alpha (Feature Flag)

- Enable for internal/test organizer accounts only.
- Collect run-time stats and failure reasons.

### Phase 2: Design Partner Beta

- Selected cafes/clubs with medium-size events.
- Weekly review of run quality, overrides, and satisfaction feedback.

### Phase 3: General Availability

- Optional mode in event setup.
- Default off until quality thresholds are met consistently.

## Acceptance Criteria (V1)

1. For benchmark datasets, solver returns feasible assignment (or best partial) within timeout.
2. Seat coverage is >= manual baseline in at least 80% of pilot events.
3. Median host assignment time decreases by at least 30% vs manual process.
4. Lock/rerun behavior is deterministic and auditable.
5. Explainability and unseated reasons are visible in UI and API responses.

## Risks and Mitigations

- **Risk:** Inputs too sparse for strong preference fit.
  - **Mitigation:** fall back to coverage-first heuristics and show low-confidence badge.
- **Risk:** Host distrusts automatic assignments.
  - **Mitigation:** explainability, locks, and easy manual override.
- **Risk:** Constraint complexity causes infeasible setups.
  - **Mitigation:** pre-run validation with actionable conflict messages.
- **Risk:** High churn between reruns frustrates users.
  - **Mitigation:** stability penalty and lock-preserving rerun defaults.

## Open Decisions (Post-V1)

- Whether to adopt exact optimization (ILP/CP-SAT) for large premium events.
- Whether to include paid "advanced optimization profiles" for hosts.
- Whether to integrate live round rotations (Swiss-like repeated rounds).
