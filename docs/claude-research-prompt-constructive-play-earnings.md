# Claude research prompt: constructive “earn while you play” games

Use this document to run a **source-backed feasibility and economics study** in Claude (or any research-capable assistant with web access).

## How to run (operator checklist)

1. **Model:** Use the strongest available model for long reasoning + synthesis (e.g. Opus-class or equivalent in your product).
2. **Tools:** Enable **web research / citations** if available; the output quality depends on current benchmarks and filings, not training cutoff alone.
3. **Phasing (recommended if context is tight):** First message: “Produce a structured outline + prioritized source list only.” Second message: “Expand each section with numbers, tables, and citations.”
4. **Copy range:** Copy everything between `BEGIN PROMPT` and `END PROMPT` into a single user message (optionally as a system message if your client supports it). Append the filled-in **Your assumptions** block if you want tailored scenarios.

---

## BEGIN PROMPT

**Role:** You are an independent research analyst and product strategist. Your job is to produce a rigorous, source-backed feasibility study—not hype—about whether it is realistic to build a game-like experience where ordinary players can earn meaningful money while their inputs/time/skills contribute to solving real-world problems.

**Personal context (tone, not evidence):** The idea came from feeling depressed after spending a lot of time in games without feeling constructive. The core question is: *What if enjoyable play could also generate income and create positive externalities?* Treat this as motivation for the inquiry, not as data.

### Your assumptions (fill in before sending, or write “use global defaults”)

- **Primary geography / regulatory frame:** <!-- e.g. EU, US, global remote -->
- **Age gate:** <!-- e.g. 18+ only, 13+ with caps, unknown -->
- **Genre / interaction shape:** <!-- e.g. puzzle, strategy, narrative, FPS-lite, async mobile -->
- **Buyer type:** <!-- B2B enterprise outcomes vs consumer-funded vs grant-funded vs hybrid -->
- **Scale placeholders (optional):** DAU <!-- -->, median daily play minutes <!-- -->, tasks accepted per active hour <!-- -->
- **Platform take-rate scenarios to stress-test:** <!-- e.g. 0/10/20/30% + fixed fee per payout -->

### Research objectives

1. **Feasibility:** Under what conditions can “fun + earnings + real impact” coexist without collapsing into exploitative piecework disguised as entertainment?
2. **Economic realism:** What do comparable labor markets actually pay for tasks that might be gamified (microtasks, labeling, translation, moderation, citizen science, human computation, expert review)? Provide **numeric ranges** and **methodology** (median vs mean, geography, sample sizes when available).
3. **Product models:** Catalog plausible architectures (examples to evaluate, not endorse): human-in-the-loop ML data labeling wrapped as puzzles; GWAP-style games with a purpose; citizen science; distributed proofreading; protein folding puzzles; crisis mapping; accessibility QA; language tutoring exchanges; “skills games” that produce deliverables for third parties; B2B outcomes sold to enterprises; public-good grants; hybrid philanthropy + sponsorship.
4. **Take-rate / platform economics:** Model player payout vs platform revenue using **explicit assumptions**. Include scenarios for platform cut (e.g., 0%, 10%, 20%, 30%) and operating costs (payment rails, fraud, dispute resolution, compliance, customer support, compute, insurance/legal). Show **hourly-equivalent earnings** after fees for at least three archetypes: *US minimum-wage benchmark*, *global remote microtask labor market*, *high-skill specialist contribution*.
5. **Regulatory and ethical constraints:** Wage/worker classification risks (employee vs contractor), cross-border payments, AML/KYC, gambling-adjacent mechanics, minors, GDPR/privacy for behavioral data, “dark patterns” that coerce unpaid labor, reputational risk of “poverty gaming.”
6. **Comparables and failure modes:** Review historical and contemporary examples (successful, marginal, and failed). Identify why payouts trend toward zero for many “play-to-earn” designs unless subsidized by speculation or unsustainable tokenomics—then separate **speculative crypto** from **real revenue-funded** models.
7. **What “enjoyable” requires:** From game design literature and product practice, what minimum UX bar prevents the experience from being “a job with XP”? When does intrinsic motivation conflict with extrinsic pay?

### Output requirements

- **Executive summary** with a clear verdict: feasible in narrow niches vs broadly vs not without subsidies—define terms.
- **Numbers-first sections** with tables:
  - Comparable hourly pay bands (cite sources, dates, geography).
  - Example unit economics for a hypothetical SKU (e.g., sold AI training data, sponsored research minutes, enterprise QA bundles)—show revenue → COGS → fraud/leakage → player pool → per-hour player payout.
  - Sensitivity analysis: if task throughput is X tasks/hour and buyer pays $Y per 1,000 tasks, what must platform take be to remain viable?
- **Source discipline:** Prefer primary sources (government stats, academic papers, company filings, reputable journalism). Flag uncertainty. Avoid cherry-picking viral claims.
- **Explicitly address crypto “play-to-earn”** as a separate appendix: what is empirically documented about median player earnings, sustainability, and regulatory exposure—then compare to **non-crypto** revenue-funded models.
- **Player welfare lens:** Minimum ethical guardrails (transparent pay formulas, opt-in, caps for minors, anti-addiction patterns, no deceptive “reward” math).
- **Go / no-go decision framework:** A checklist a founder could use to validate a concept in 30 days (buyer interviews, willingness-to-pay, task measurability, fraud test, legal review triggers).

### Suggested research workflow (you may take as long as needed)

- Start with a **structured outline** and a **source list** before deep writing.
- Use web research to update figures to **current** market conditions (state the “as of” date).
- Cross-check conflicting claims (especially in blockchain gaming and gig-economy marketing).
- If exact numbers are impossible, provide **bounded estimates** with confidence notes.

### Deliverable formats

- Primary: a long report (Markdown-friendly headings).
- Optional annex: a **one-page investor memo** + a **one-page player-facing honesty memo** (what you can realistically earn, and what you cannot promise).

### Hard constraints on your analysis

- Do not promise earnings to the user; provide **ranges** and **conditions**.
- Treat “fun” as a design constraint that affects throughput and quality—quantify tradeoffs where possible.
- Identify the **single hardest bottleneck** (buyer demand, quality control, fraud, legal classification, unit economics, retention, or ethical optics) for each major model family.

## END PROMPT

---

## Notes

- Ask the model for **URLs or DOIs** in-line or in a **References** section.
- If you need a **founder-specific** payout estimate (“how much could I earn if I take a cut”), the prompt already forces explicit take-rate math; the **Your assumptions** block is what makes that answer about *your* product rather than the whole planet.
