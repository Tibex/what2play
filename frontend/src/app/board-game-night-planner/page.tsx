import type { Metadata } from "next";
import GuideShell, {
  type GuideFaq,
  type GuideSection,
} from "@/components/seo/GuideShell";
import JsonLd from "@/components/seo/JsonLd";
import { getKeywordCluster } from "@/lib/keyword-clusters";
import { absoluteUrl, createPageMetadata } from "@/lib/seo";

const cluster = getKeywordCluster("board-game-night-planner");

export const metadata: Metadata = createPageMetadata({
  title: cluster.pageTitle,
  description: cluster.metaDescription,
  path: cluster.path,
  keywords: [
    cluster.primaryKeyword,
    "game night organizer app",
    "plan board game meetup",
    "board game event planning",
    "board game table assignment",
  ],
});

const sections: GuideSection[] = [
  {
    heading: "What a board game night planner should solve",
    paragraphs: [
      "A useful planner must coordinate date, attendance, game options, shelf imports, and final selection in one flow. Splitting those steps across chat, polls, and notes creates friction every week.",
      "When your process is centralized, people know where to RSVP, what games are in scope, and when a final pick is locked.",
    ],
    bullets: [
      "Single place for event setup, attendance, and game candidates",
      "Collection coverage via BGG sync plus shelf photo parsing (Gemini + Claude + OCR supplement)",
      "Date polling for invite-only groups before finalizing the event time",
      "Clear player-count and time-budget constraints",
      "Final decision workflow so planning does not stall",
    ],
  },
  {
    heading: "Use event constraints before discussing games",
    paragraphs: [
      "Start with the real constraints: attendees, available time, and desired complexity. This immediately removes mismatched options and keeps the shortlist practical.",
      "What2Play is designed around that sequence so recommendation and voting steps stay focused on playable options.",
    ],
  },
  {
    heading: "Build a repeatable planning cycle",
    paragraphs: [
      "Recurring groups benefit from a consistent pre-event and post-event loop: create event, shortlist games, vote, lock decision, collect lightweight feedback.",
      "That cycle keeps each game night easier to organize than the previous one.",
    ],
    bullets: [
      "For larger confirmed events, generate multi-table seating from vote results",
      "Optimize seat coverage first, then preference fit across tables",
      "Lock seats and rerun when host constraints change",
      "Optionally apply AI recommendation re-ranking before final voting",
    ],
  },
];

const faqs: GuideFaq[] = [
  {
    question: "Is What2Play only for large game groups?",
    answer:
      "No. It works for small recurring groups and larger communities, and includes multi-table seating support when attendance is high.",
  },
  {
    question: "Can hosts still override the vote result?",
    answer:
      "Yes. Hosts can lock final selections when logistics require a manual decision, and keep fallback games ready if attendance changes.",
  },
  {
    question: "Do players need accounts before joining?",
    answer:
      "Hosts can share invite links and bring people into the planning flow quickly.",
  },
];

export default function BoardGameNightPlannerPage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: cluster.pageTitle,
      url: absoluteUrl(cluster.path),
      description: cluster.metaDescription,
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "What2Play",
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Web",
      url: absoluteUrl("/"),
      featureList: [
        "Event setup and RSVP tracking",
        "Recommendation shortlist with optional AI re-ranking",
        "Ranked voting and final lock-in",
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
        intro="Plan your board game night from invitation to final game selection without juggling multiple tools."
        sections={sections}
        faqs={faqs}
        relatedPaths={[
          "/board-game-cafe-table-planner",
          "/board-game-voting-app",
          "/board-game-recommendation-tool",
          "/board-game-shelf-parser",
          "/how-to-plan-a-board-game-night",
        ]}
      />
    </>
  );
}
