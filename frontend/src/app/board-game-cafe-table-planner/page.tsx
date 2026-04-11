import type { Metadata } from "next";
import GuideShell, {
  type GuideFaq,
  type GuideSection,
} from "@/components/seo/GuideShell";
import JsonLd from "@/components/seo/JsonLd";
import { getKeywordCluster } from "@/lib/keyword-clusters";
import { absoluteUrl, createPageMetadata } from "@/lib/seo";

const cluster = getKeywordCluster("board-game-cafe-table-planner");

export const metadata: Metadata = createPageMetadata({
  title: cluster.pageTitle,
  description: cluster.metaDescription,
  path: cluster.path,
  keywords: [
    cluster.primaryKeyword,
    "board game table assignment tool",
    "board game club seating planner",
    "multi table board game event organizer",
  ],
});

const sections: GuideSection[] = [
  {
    heading: "Why cafes need multi-table planning",
    paragraphs: [
      "Board game cafes and club nights rarely run a single game. Hosts need to seat many attendees across multiple tables while keeping player counts valid for each title.",
      "Manual table assignment is slow and often feels unfair when player preferences are ignored.",
    ],
    bullets: [
      "Account for game min/max player constraints at each table",
      "Use vote results to reduce mismatched seating decisions",
      "Keep host control for late changes and special requests",
    ],
  },
  {
    heading: "Run seating optimization after voting closes",
    paragraphs: [
      "The most practical sequence is shortlist -> vote -> confirm -> seat. This keeps table assignments tied to real demand rather than pre-vote guesses.",
      "What2Play uses a balanced objective for large confirmed events: maximize seat coverage first, then maximize vote/preference fit.",
    ],
  },
  {
    heading: "Keep operations flexible during event setup",
    paragraphs: [
      "Real events change quickly: no-shows, late arrivals, and host constraints. Multi-table plans work best when organizers can lock critical seats and rerun the rest.",
      "This gives cafes speed from automation without losing trust or explainability.",
    ],
    bullets: [
      "Auto-select an optimized table count for attendance",
      "Allow lock-and-rerun controls for host adjustments",
      "Expose clear reasons when someone cannot be seated",
    ],
  },
];

const faqs: GuideFaq[] = [
  {
    question: "Is this useful only for large cafes?",
    answer:
      "No. It is most valuable for larger sessions, but clubs and meetup groups also benefit when more than one table is needed.",
  },
  {
    question: "Can hosts finish voting before everyone submits?",
    answer:
      "Yes. Hosts can close voting when enough signal exists, then run seating optimization from the confirmed result.",
  },
  {
    question: "What if a player is assigned to a game they did not vote for?",
    answer:
      "The optimizer prioritizes seat coverage first, then vote/preference fit. Hosts can still lock or adjust assignments before finalizing.",
  },
];

export default function BoardGameCafeTablePlannerPage() {
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
        "Ranked voting for game selection",
        "Post-vote multi-table seat optimization",
        "Host lock and rerun controls",
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
        intro="Plan board game cafe and club events with a practical multi-table workflow that turns votes into seatable table assignments."
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
