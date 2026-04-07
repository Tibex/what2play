'use client';

import Link from 'next/link';
import GameCard from '@/components/GameCard';
import { GuestRecommendationDemo } from './GuestRecommendationDemo';
import { getHeroRecommendationPreview } from '@/lib/landing-demo-recommendations';
import { KEYWORD_CLUSTERS } from '@/lib/keyword-clusters';
import { useRegisterModalStore } from '@/lib/register-modal-store';

function HeroRecommendationPreview() {
  const rows = getHeroRecommendationPreview();
  return (
    <div className="wt-card-raised p-5 sm:p-6 space-y-4 max-w-md mx-auto lg:mx-0">
      <div className="flex items-center justify-between text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">
        <span>Game night</span>
        <span className="wt-chip normal-case">Voting open</span>
      </div>
      <div className="space-y-2">
        <div className="h-2.5 rounded-full bg-[var(--primary-soft)] w-3/4" />
        <div className="h-2 rounded-full bg-[var(--surface)] w-1/2" />
      </div>
      <div className="space-y-2">
        {rows.map((row) => (
          <GameCard
            key={row.game.id}
            game={row.game}
            showScore={row.score}
            size="compact"
            previewPills={row.pills}
            bggUrl={row.game.bggId ? `https://boardgamegeek.com/boardgame/${row.game.bggId}` : undefined}
          />
        ))}
      </div>
      <div className="flex gap-2 pt-1">
        <div className="h-9 flex-1 rounded-lg bg-[var(--primary)]/15 border border-[var(--primary)]/25" />
        <div className="h-9 w-24 rounded-lg bg-[var(--surface)] border border-[var(--border)]" />
      </div>
    </div>
  );
}

export function LandingMarketing() {
  const openRegisterModal = useRegisterModalStore((s) => s.open);

  return (
    <div className="min-h-screen flex flex-col text-[var(--foreground)]">
      <main className="flex-1">
        <section className="wt-page px-4 sm:px-6 py-14 sm:py-20 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-[var(--foreground)] leading-tight">
                Stop debating.
                <span className="text-[var(--primary)]"> Start playing.</span>
              </h1>
              <p className="mt-5 text-lg sm:text-xl wt-muted max-w-xl">
                Your group&apos;s collections, real constraints, and a fair vote—so you pick a game everyone can get to the table and enjoy.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={openRegisterModal}
                  className="wt-btn wt-btn-primary px-5 py-3 text-base font-semibold no-underline text-white"
                >
                  Create free account
                </button>
                <a
                  href="#how-it-works"
                  className="wt-btn wt-btn-secondary px-5 py-3 text-base font-semibold no-underline text-[var(--foreground)]"
                >
                  How it works
                </a>
              </div>
            </div>
            <HeroRecommendationPreview />
          </div>
        </section>

        <section className="border-y border-[var(--border)] bg-[var(--paper)]/60">
          <div className="wt-page px-4 sm:px-6 py-12 sm:py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-center max-w-2xl mx-auto">
              One place to propose, rank, and lock a game
            </h2>
            <ul className="mt-10 grid sm:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {[
                {
                  title: 'Chat goes in circles',
                  body: 'Too many options and no decision—sound familiar?',
                },
                {
                  title: 'Mismatched nights',
                  body: 'Wrong player count, playtime, or weight for the group you actually have.',
                },
                {
                  title: 'No memory for next time',
                  body: 'What worked (or bombed) gets lost before the next meetup.',
                },
              ].map((item) => (
                <li key={item.title} className="text-center sm:text-left">
                  <p className="font-semibold text-[var(--foreground)]">{item.title}</p>
                  <p className="mt-2 text-sm wt-muted leading-relaxed">{item.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-20">
          <div className="wt-page px-4 sm:px-6 py-14 sm:py-20">
            <h2 className="text-2xl sm:text-3xl font-bold text-center">How it works</h2>
            <p className="mt-3 text-center wt-muted max-w-xl mx-auto">
              Plan the night, narrow the list, vote, then learn for the next session.
            </p>
            <ol className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  step: '1',
                  title: 'Link your shelf',
                  body: 'Build your library manually or sync from BoardGameGeek.',
                },
                {
                  step: '2',
                  title: 'Create an event',
                  body: 'Set a fixed date or run an availability poll, then collect RSVPs and attendee preferences.',
                },
                {
                  step: '3',
                  title: 'Get suggestions',
                  body: 'See candidates your group can actually bring—with short “why” labels.',
                },
                {
                  step: '4',
                  title: 'Vote and improve',
                  body: 'Rank choices, lock a winner with fallback options, then quick feedback shapes the next night.',
                },
              ].map((item) => (
                <li key={item.step} className="wt-card p-6 relative overflow-hidden">
                  <span className="text-4xl font-bold text-[var(--primary-soft)] select-none absolute right-4 top-3 tabular-nums">
                    {item.step}
                  </span>
                  <p className="font-semibold text-[var(--foreground)] pr-12">{item.title}</p>
                  <p className="mt-2 text-sm wt-muted leading-relaxed">{item.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-t border-[var(--border)] bg-[var(--surface)]/40">
          <div className="wt-page px-4 sm:px-6 py-14 sm:py-20">
            <div className="max-w-2xl mx-auto text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold">Try sample recommendations</h2>
              <p className="mt-3 wt-muted">
                Pick a few constraints and see illustrative picks. No account needed—this demo uses a fixed catalog, not your collection.
              </p>
            </div>
            <GuestRecommendationDemo />
          </div>
        </section>

        <section id="resources" className="border-t border-[var(--border)] bg-[var(--paper)]/65">
          <div className="wt-page px-4 sm:px-6 py-14 sm:py-16">
            <div className="max-w-3xl">
              <h2 className="text-2xl sm:text-3xl font-bold">Board game planning resources</h2>
              <p className="mt-3 wt-muted">
                Explore practical guides for planning, voting, recommendations, and BoardGameGeek-based collection workflows.
              </p>
            </div>
            <ul className="mt-8 grid md:grid-cols-2 lg:grid-cols-3 gap-4 list-none p-0">
              {KEYWORD_CLUSTERS.map((cluster) => (
                <li key={cluster.id} className="wt-card p-5">
                  <p className="wt-chip mb-3">{cluster.primaryKeyword}</p>
                  <h3 className="font-semibold text-[var(--foreground)]">
                    <Link href={cluster.path} className="hover:text-[var(--primary)]">
                      {cluster.pageTitle}
                    </Link>
                  </h3>
                  <p className="mt-2 text-sm wt-muted leading-relaxed">{cluster.summary}</p>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Link href="/resources" className="wt-btn wt-btn-secondary px-5 py-2.5 text-sm no-underline text-[var(--foreground)]">
                Browse all guides
              </Link>
            </div>
          </div>
        </section>

        <section>
          <div className="wt-page px-4 sm:px-6 py-14 sm:py-16">
            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  title: 'Everyone’s collection, one picture',
                  body: 'Suggestions can prioritize what attendees actually own—so “who brought that?” is answered up front.',
                },
                {
                  title: 'Fair decisions',
                  body: 'Ranked voting and host controls help groups commit instead of circling forever.',
                },
                {
                  title: 'Works for private and open nights',
                  body: 'Run invite-only events with friend tools, or host open events that players can discover from the dashboard.',
                },
                {
                  title: 'See what your shelf actually delivers',
                  body: 'Track which games from your collection get picked, how they rank in votes, and how much your group enjoys them.',
                },
              ].map((block) => (
                <div key={block.title} className="wt-subtle p-6">
                  <h3 className="font-semibold text-[var(--foreground)]">{block.title}</h3>
                  <p className="mt-2 text-sm wt-muted leading-relaxed">{block.body}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 text-center text-sm wt-muted max-w-2xl mx-auto">
              BoardGameGeek linking uses your BGG username; sync runs on our servers. We don’t claim any official partnership with BGG.
            </p>
          </div>
        </section>

        <section className="border-t border-[var(--border)] bg-[var(--paper)]/70">
          <div className="wt-page px-4 sm:px-6 py-12 sm:py-14 max-w-2xl mx-auto text-center">
            <h2 className="text-xl font-bold">Trust and who it’s for</h2>
            <p className="mt-3 text-sm wt-muted leading-relaxed">
              We store what you need to run game nights: your profile, library, events, RSVPs, votes, and optional feedback.
              Use private invites for your regular group, or explore open events when you want to meet new players—your call.
            </p>
          </div>
        </section>

      </main>

    </div>
  );
}
