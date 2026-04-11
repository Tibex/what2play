import type { Metadata } from "next";
import GuideShell, {
  type GuideFaq,
  type GuideSection,
} from "@/components/seo/GuideShell";
import JsonLd from "@/components/seo/JsonLd";
import { getKeywordCluster } from "@/lib/keyword-clusters";
import { absoluteUrl, createPageMetadata } from "@/lib/seo";

const cluster = getKeywordCluster("board-game-recommendation-tool");

export const metadata: Metadata = createPageMetadata({
  title: cluster.pageTitle,
  description: cluster.metaDescription,
  path: cluster.path,
  keywords: [
    cluster.primaryKeyword,
    "board game recommender by players",
    "game recommendation by complexity and duration",
    "what board game should we play tonight",
  ],
});

const sections: GuideSection[] = [
  {
    heading: "Recommendation quality depends on context, not popularity",
    paragraphs: [
      "A good board game recommendation tool starts with your real table constraints. Player count, remaining time, and complexity tolerance matter more than generic top-game lists.",
      "Recommendations should be explainable so groups can trust why a game is on the shortlist.",
    ],
  },
  {
    heading: "Prioritize games attendees can actually play",
    paragraphs: [
      "If a game is not available in attendee collections, it can still be interesting but less practical for tonight. Your recommendation workflow should separate ideal fits from immediately playable fits.",
      "What2Play uses collection awareness alongside constraints so your shortlist is useful in real event planning.",
    ],
    bullets: [
      "Filter by player count and time first",
      "Apply complexity preferences for the current group",
      "Highlight games attendees can bring now",
      "Support fallback picks when turnout changes",
    ],
  },
  {
    heading: "Pair recommendations with voting and feedback",
    paragraphs: [
      "Recommendations improve when they are connected to actual outcomes. If a group consistently enjoys specific weight and duration ranges, that feedback loop should influence future shortlists.",
      "This creates a learning system instead of a one-off recommendation result.",
    ],
  },
];

const faqs: GuideFaq[] = [
  {
    question: "Can recommendations include games not owned by attendees?",
    answer:
      "Yes. Discovery-style recommendations can include non-owned games when hosts want broader exploration.",
  },
  {
    question: "How many games should a shortlist include?",
    answer:
      "A shortlist of 5-10 options is usually enough to support quick voting without overwhelming attendees.",
  },
  {
    question: "Do recommendations replace host judgment?",
    answer:
      "No. Recommendations narrow options, and hosts still decide how strict constraints should be.",
  },
  {
    question: "Can hosts manually adjust recommendation lists?",
    answer:
      "Yes. Hosts can add or remove candidates before voting to reflect context that automation might miss.",
  },
];

export default function BoardGameRecommendationToolPage() {
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
        intro="Find playable game options for tonight by combining player count, duration, complexity, and collection availability."
        sections={sections}
        faqs={faqs}
        relatedPaths={[
          "/board-game-cafe-table-planner",
          "/board-game-night-planner",
          "/board-game-voting-app",
          "/boardgamegeek-collection-sync",
        ]}
      />
    </>
  );
}
