"use client";

import React from "react";
import Link from "next/link";
import GameCard from "@/components/GameCard";
import { GuestRecommendationDemo } from "./GuestRecommendationDemo";
import { getHeroRecommendationPreview } from "@/lib/landing-demo-recommendations";
import { KEYWORD_CLUSTERS } from "@/lib/keyword-clusters";
import { useRegisterModalStore } from "@/lib/register-modal-store";

// ─── Hero preview card ───────────────────────────────────────────────────────

function HeroRecommendationPreview() {
  const rows = getHeroRecommendationPreview();
  return (
    <div className="wt-card-raised p-5 sm:p-6 space-y-4 max-w-md mx-auto lg:mx-0">
      {/* Event header row */}
      <div
        className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide"
        style={{ color: "var(--muted)" }}
      >
        <span>Game night</span>
        <span
          className="wt-chip"
          style={{
            background: "var(--primary-soft)",
            border: "1px solid rgba(29,107,74,0.2)",
            color: "var(--primary)",
          }}
        >
          Voting open
        </span>
      </div>

      {/* Event title skeleton — visible on light bg */}
      <div className="space-y-2">
        <div
          className="h-2.5 rounded-full w-3/4"
          style={{ background: "var(--surface-strong)" }}
          aria-label="Event title placeholder"
        />
        <div
          className="h-2 rounded-full w-1/2"
          style={{ background: "var(--surface)" }}
        />
      </div>

      {/* Game candidates */}
      <div className="space-y-2">
        {rows.map((row) => (
          <GameCard
            key={row.game.id}
            game={row.game}
            showScore={row.score}
            size="compact"
            previewPills={row.pills}
            bggUrl={
              row.game.bggId
                ? `https://boardgamegeek.com/boardgame/${row.game.bggId}`
                : undefined
            }
          />
        ))}
      </div>

      {/* Action bar skeleton */}
      <div className="flex gap-2 pt-1">
        <div
          className="h-9 flex-1 rounded-lg"
          style={{
            background: "var(--primary-soft)",
            border: "1px solid rgba(29,107,74,0.2)",
          }}
        />
        <div
          className="h-9 w-24 rounded-lg"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        />
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function PainCard({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon: React.ReactNode;
}) {
  return (
    <li className="wt-subtle p-6">
      <div className="wt-icon-wrap wt-icon-wrap-accent mb-4" aria-hidden="true">
        {icon}
      </div>
      <p className="font-semibold" style={{ color: "var(--foreground)" }}>
        {title}
      </p>
      <p
        className="mt-2 text-sm leading-relaxed"
        style={{ color: "var(--muted)" }}
      >
        {body}
      </p>
    </li>
  );
}

function StepCard({
  step,
  title,
  body,
}: {
  step: string;
  title: string;
  body: string;
}) {
  return (
    <li className="wt-glow-card p-6 relative overflow-hidden">
      <span
        className="text-5xl font-black select-none absolute right-4 top-2 tabular-nums"
        style={{ color: "var(--primary-soft)", lineHeight: 1 }}
        aria-hidden="true"
      >
        {step}
      </span>
      <div className="wt-step-badge mb-4">{step}</div>
      <p className="font-semibold pr-10" style={{ color: "var(--foreground)" }}>
        {title}
      </p>
      <p
        className="mt-2 text-sm leading-relaxed"
        style={{ color: "var(--muted)" }}
      >
        {body}
      </p>
    </li>
  );
}

function FeatureBlock({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="wt-subtle p-6 flex gap-4">
      <div className="wt-icon-wrap shrink-0 mt-0.5" aria-hidden="true">
        {icon}
      </div>
      <div>
        <h3
          className="font-semibold text-base"
          style={{ color: "var(--foreground)" }}
        >
          {title}
        </h3>
        <p
          className="mt-1.5 text-sm leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          {body}
        </p>
      </div>
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function LandingMarketing() {
  const openRegisterModal = useRegisterModalStore((s) => s.open);

  return (
    <div
      className="wt-marketing min-h-screen flex flex-col"
      style={{ color: "var(--foreground)" }}
    >
      <main className="flex-1">
        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="wt-page px-4 sm:px-6 py-16 sm:py-24 lg:py-28">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <p className="wt-section-label mb-4">Board game night planner</p>

              <h1
                className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold tracking-tight leading-[1.08]"
                style={{ color: "var(--foreground)" }}
              >
                Stop debating.
                <br />
                Start playing.
              </h1>

              <p
                className="mt-5 text-lg sm:text-xl leading-relaxed max-w-lg"
                style={{ color: "var(--muted)" }}
              >
                Collect your group&apos;s game libraries, import shelf photos,
                filter by real constraints, run AI-assisted ranking plus voting,
                and seat larger events across tables — all in one place.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={openRegisterModal}
                  className="wt-btn wt-btn-primary px-6 py-3 text-base"
                >
                  Create free account
                </button>
                <a
                  href="#how-it-works"
                  className="wt-btn wt-btn-secondary px-6 py-3 text-base no-underline"
                  style={{ color: "var(--foreground)" }}
                >
                  How it works
                </a>
              </div>

              <p className="mt-5 text-xs" style={{ color: "var(--muted)" }}>
                Free to use · No credit card · BGG sync included
              </p>
            </div>

            <HeroRecommendationPreview />
          </div>
        </section>

        {/* ── Pain points ───────────────────────────────────────────────────── */}
        <section className="border-y" style={{ borderColor: "var(--border)" }}>
          <div className="wt-page px-4 sm:px-6 py-14 sm:py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-center max-w-2xl mx-auto">
              Sound familiar?
            </h2>
            <ul className="mt-10 grid sm:grid-cols-3 gap-5 max-w-4xl mx-auto list-none p-0">
              <PainCard
                title="Chat goes in circles"
                body="Too many options, no decision — the group chat turns into a debate about a debate."
                icon={
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                }
              />
              <PainCard
                title="Wrong game for the room"
                body="Player count, playtime, or weight don't match the people who actually showed up."
                icon={
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4l3 3" />
                  </svg>
                }
              />
              <PainCard
                title="No memory for next time"
                body="What worked — or bombed — gets lost before the next meetup."
                icon={
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                    <path d="M12 16v-4M12 8h.01" />
                  </svg>
                }
              />
            </ul>
          </div>
        </section>

        {/* ── How it works ──────────────────────────────────────────────────── */}
        <section id="how-it-works" className="scroll-mt-20">
          <div className="wt-page px-4 sm:px-6 py-16 sm:py-20">
            <h2 className="text-2xl sm:text-3xl font-bold text-center">
              How it works
            </h2>
            <p
              className="mt-3 text-center max-w-xl mx-auto"
              style={{ color: "var(--muted)" }}
            >
              Plan the night, narrow the list, vote, then learn for next time.
            </p>
            <ol className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-5 list-none p-0">
              <StepCard
                step="1"
                title="Link your shelf"
                body="Build your library manually or sync from BoardGameGeek in seconds."
              />
              <StepCard
                step="2"
                title="Create an event"
                body="Set a date or run an availability poll, then collect RSVPs and preferences."
              />
              <StepCard
                step="3"
                title="Get suggestions"
                body="See candidates your group can actually bring, then let AI re-rank by context with clear reasons why."
              />
              <StepCard
                step="4"
                title="Vote, seat, improve"
                body="Rank choices, confirm the winner, auto-seat larger groups, then capture feedback."
              />
            </ol>
          </div>
        </section>

        {/* ── Interactive demo ──────────────────────────────────────────────── */}
        <section
          className="border-t"
          style={{ borderColor: "var(--border)", background: "var(--paper)" }}
        >
          <div className="wt-page px-4 sm:px-6 py-16 sm:py-20">
            <div className="max-w-2xl mx-auto text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold">
                Try sample recommendations
              </h2>
              <p className="mt-3" style={{ color: "var(--muted)" }}>
                Pick constraints and see illustrative picks. No account needed —
                this demo uses a fixed catalog.
              </p>
            </div>
            <GuestRecommendationDemo />
          </div>
        </section>

        {/* ── Resources ─────────────────────────────────────────────────────── */}
        <section className="border-t" style={{ borderColor: "var(--border)" }}>
          <div className="wt-page px-4 sm:px-6 py-14 sm:py-16">
            <div className="max-w-3xl mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold">
                Board game planning resources
              </h2>
              <p className="mt-3" style={{ color: "var(--muted)" }}>
                Practical guides for planning, voting, recommendations, and
                BoardGameGeek collection workflows.
              </p>
            </div>
            <ul className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 list-none p-0">
              {KEYWORD_CLUSTERS.map((cluster) => (
                <li key={cluster.id} className="wt-glow-card p-5">
                  <p className="wt-chip mb-3" style={{ fontSize: "0.7rem" }}>
                    {cluster.primaryKeyword}
                  </p>
                  <h3
                    className="font-semibold"
                    style={{ color: "var(--foreground)" }}
                  >
                    <Link
                      href={cluster.path}
                      className="no-underline transition-colors hover:underline"
                      style={{ color: "inherit" }}
                    >
                      {cluster.pageTitle}
                    </Link>
                  </h3>
                  <p
                    className="mt-2 text-sm leading-relaxed"
                    style={{ color: "var(--muted)" }}
                  >
                    {cluster.summary}
                  </p>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Link
                href="/resources"
                className="wt-btn wt-btn-secondary px-5 py-2.5 text-sm no-underline"
                style={{ color: "var(--foreground)" }}
              >
                Browse all guides
              </Link>
            </div>
          </div>
        </section>

        {/* ── Feature highlights ────────────────────────────────────────────── */}
        <section
          className="border-t"
          style={{ borderColor: "var(--border)", background: "var(--paper)" }}
        >
          <div className="wt-page px-4 sm:px-6 py-14 sm:py-16">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              <FeatureBlock
                title="Everyone's collection, one picture"
                body="Use BGG sync or shelf photo parsing (multi-model detection + OCR supplement) so suggestions prioritize what attendees actually own."
                icon={
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                }
              />
              <FeatureBlock
                title="Fair decisions"
                body="Ranked voting and host controls help groups commit. Multi-table seating keeps large events practical."
                icon={
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="9 11 12 14 22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                }
              />
              <FeatureBlock
                title="Smarter recommendations"
                body="AI re-ranking adjusts candidate order using event context and prior feedback while keeping host overrides in control."
                icon={
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 2v20" />
                    <path d="M5 8h14" />
                    <path d="M5 16h14" />
                    <circle cx="7" cy="8" r="1.5" />
                    <circle cx="12" cy="16" r="1.5" />
                    <circle cx="17" cy="8" r="1.5" />
                  </svg>
                }
              />
              <FeatureBlock
                title="Private and open nights"
                body="Run invite-only events with friend tools, or host open events players can discover from the dashboard."
                icon={
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                }
              />
              <FeatureBlock
                title="See what your shelf delivers"
                body="Track which games get picked, how they rank in votes, and how much your group enjoys them."
                icon={
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                }
              />
            </div>
            <p
              className="mt-8 text-center text-xs max-w-2xl mx-auto"
              style={{ color: "var(--muted)" }}
            >
              BoardGameGeek linking uses your BGG username; sync runs on our
              servers. No official partnership with BGG.
            </p>
          </div>
        </section>

        {/* ── CTA ───────────────────────────────────────────────────────────── */}
        <section className="border-t" style={{ borderColor: "var(--border)" }}>
          <div className="wt-page px-4 sm:px-6 py-16 sm:py-20">
            <div className="wt-cta-band px-8 py-14 text-center">
              <p className="wt-section-label mb-4 justify-center">
                Free forever
              </p>
              <h2 className="text-2xl sm:text-3xl">Ready to end the debate?</h2>
              <p
                className="mt-3 max-w-md mx-auto text-base"
                style={{ color: "var(--muted)" }}
              >
                Free to use. No credit card. Works for any group size.
              </p>
              <button
                type="button"
                onClick={openRegisterModal}
                className="wt-btn wt-btn-primary mt-7 px-8 py-3.5 text-base"
              >
                Create free account
              </button>
              <p className="mt-4 text-xs" style={{ color: "var(--muted)" }}>
                BGG sync included · No ads · No paywalls
              </p>
            </div>
          </div>
        </section>

        {/* ── Trust note ────────────────────────────────────────────────────── */}
        <section
          className="border-t"
          style={{ borderColor: "var(--border)", background: "var(--paper)" }}
        >
          <div
            className="wt-page px-4 sm:px-6 py-8 max-w-2xl mx-auto text-center text-xs leading-relaxed"
            style={{ color: "var(--muted)" }}
          >
            We store what you need to run game nights: profile, library, events,
            RSVPs, votes, and optional feedback. Use private invites for your
            regular group, or explore open events — your call.
          </div>
        </section>
      </main>
    </div>
  );
}
