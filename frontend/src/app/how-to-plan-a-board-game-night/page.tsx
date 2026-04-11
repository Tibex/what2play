import type { Metadata } from "next";
import GuideShell, {
  type GuideFaq,
  type GuideSection,
} from "@/components/seo/GuideShell";
import JsonLd from "@/components/seo/JsonLd";
import { getKeywordCluster } from "@/lib/keyword-clusters";
import { absoluteUrl, createPageMetadata } from "@/lib/seo";

const cluster = getKeywordCluster("how-to-plan-a-board-game-night");

export const metadata: Metadata = createPageMetadata({
  title: cluster.pageTitle,
  description: cluster.metaDescription,
  path: cluster.path,
  keywords: [
    cluster.primaryKeyword,
    "board game night checklist",
    "how to host a game night",
    "plan board game event",
  ],
  type: "article",
});

const sections: GuideSection[] = [
  {
    heading: "1. Confirm constraints before sending invites",
    paragraphs: [
      "Decide the date, expected attendee count, and maximum session length first. These variables determine which games are even viable and reduce scheduling churn.",
      "Send invites with clear RSVP expectations so you can finalize the shortlist as attendance becomes stable.",
    ],
  },
  {
    heading: "2. Build a shortlist that fits the real table",
    paragraphs: [
      "Use player count, duration, and complexity to create a shortlist of 5-10 games. Avoid broad lists that include obvious mismatches.",
      "If your group uses What2Play, recommendations can start from attendee collections so the list is practical for tonight.",
    ],
    bullets: [
      "Filter by attendance and playtime budget",
      "Exclude games unavailable to the active group",
      "Keep the shortlist small enough for quick voting",
    ],
  },
  {
    heading: "3. Run ranked voting and lock a final pick",
    paragraphs: [
      "Set a voting deadline and collect ordered preferences. Ranked choices reduce ties and prevent last-minute chat chaos from deciding the night.",
      "Hosts should lock the final game and share setup details once the vote closes.",
    ],
  },
  {
    heading: "4. Capture lightweight post-event feedback",
    paragraphs: [
      "A short feedback loop after each session helps you choose better games next time. Track whether players enjoyed the game, finished it, and felt the length was right.",
      "Over time, this builds a reliable profile of what your group actually likes.",
    ],
  },
];

const faqs: GuideFaq[] = [
  {
    question: "How far in advance should I plan a board game night?",
    answer:
      "For recurring groups, 5-10 days is usually enough to collect RSVPs and finalize a shortlist.",
  },
  {
    question: "How many game options should I present?",
    answer:
      "Aim for 5-10 options. Fewer can feel restrictive, and more slows down voting.",
  },
  {
    question: "Should I choose the game before attendees RSVP?",
    answer:
      "Usually no. Wait for RSVP signals so player-count and complexity fit the final group.",
  },
];

export default function HowToPlanABoardGameNightPage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: cluster.pageTitle,
      description: cluster.metaDescription,
      url: absoluteUrl(cluster.path),
      author: {
        "@type": "Organization",
        name: "What2Play",
      },
      publisher: {
        "@type": "Organization",
        name: "What2Play",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: "How to plan a board game night",
      step: [
        {
          "@type": "HowToStep",
          name: "Confirm constraints",
          text: "Set date, expected attendance, and time budget.",
        },
        {
          "@type": "HowToStep",
          name: "Build shortlist",
          text: "Filter games by player count, duration, and complexity.",
        },
        {
          "@type": "HowToStep",
          name: "Run voting",
          text: "Collect ranked votes and lock the final game.",
        },
        {
          "@type": "HowToStep",
          name: "Capture feedback",
          text: "Collect quick post-event feedback to improve future planning.",
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer,
        },
      })),
    },
  ] satisfies Record<string, unknown>[];

  return (
    <>
      <JsonLd data={jsonLd} />
      <GuideShell
        title={cluster.pageTitle}
        keyword={cluster.primaryKeyword}
        path={cluster.path}
        intro="Use this practical checklist to run smoother board game nights and reduce decision friction."
        sections={sections}
        faqs={faqs}
        relatedPaths={[
          "/board-game-night-planner",
          "/board-game-voting-app",
          "/board-game-recommendation-tool",
        ]}
      />
    </>
  );
}
