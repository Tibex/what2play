import type { Metadata } from "next";
import GuideShell, {
  type GuideFaq,
  type GuideSection,
} from "@/components/seo/GuideShell";
import JsonLd from "@/components/seo/JsonLd";
import { getKeywordCluster } from "@/lib/keyword-clusters";
import { absoluteUrl, createPageMetadata } from "@/lib/seo";

const cluster = getKeywordCluster("board-game-voting-app");

export const metadata: Metadata = createPageMetadata({
  title: cluster.pageTitle,
  description: cluster.metaDescription,
  path: cluster.path,
  keywords: [
    cluster.primaryKeyword,
    "ranked choice board game voting",
    "choose board game with friends",
    "game night poll app",
  ],
});

const sections: GuideSection[] = [
  {
    heading: "Why game-night decisions usually stall",
    paragraphs: [
      "Most groups treat voting as a quick thumbs-up poll, but ties and popular-yet-poor-fit games still create indecision. You need a method that captures preference order, not just first choice.",
      "A board game voting app should make tradeoffs visible and produce a winner that players understand.",
    ],
  },
  {
    heading: "Use ranked voting for fairer outcomes",
    paragraphs: [
      "Ranked voting lets each player prioritize several options instead of a single vote. This reduces tie noise and avoids defaulting to whichever person speaks last in chat.",
      "When paired with a shortlist that already matches time and player constraints, ranked results are usually actionable immediately.",
    ],
    bullets: [
      "Collect ordered preferences instead of single-option votes",
      "Keep voting windows clear with deadlines",
      "Show transparent results and tie-break behavior",
    ],
  },
  {
    heading: "Connect voting to planning outcomes",
    paragraphs: [
      "Voting should not be a standalone feature. It should feed directly into the event record so selected games and final attendance stay connected for future planning.",
      "That continuity helps recurring groups build better recommendation quality over time.",
    ],
    bullets: [
      "Host can finish voting early when enough signal exists",
      "Confirmed vote results can trigger multi-table seat optimization for large events",
      "Assignments remain override-friendly with host locks",
    ],
  },
];

const faqs: GuideFaq[] = [
  {
    question: "Can hosts open voting before everyone RSVPs?",
    answer:
      "Yes, but results are best when the candidate list and attendee set are close to final.",
  },
  {
    question: "Does ranked voting work for casual groups?",
    answer:
      "Yes. Players only need to order options from most to least preferred; the app handles scoring.",
  },
  {
    question: "What if the winning game is unavailable on event day?",
    answer:
      "Hosts can lock fallback options while preserving the voting record for future sessions.",
  },
  {
    question: "Can we keep results hidden until everyone has voted?",
    answer:
      "Hosts can keep results hidden during active voting, then reveal them by finishing voting when the group is ready.",
  },
];

export default function BoardGameVotingAppPage() {
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
        intro="Use ranked voting so your group can move from shortlist to final game decision quickly and fairly."
        sections={sections}
        faqs={faqs}
        relatedPaths={[
          "/board-game-cafe-table-planner",
          "/board-game-night-planner",
          "/board-game-recommendation-tool",
          "/how-to-plan-a-board-game-night",
        ]}
      />
    </>
  );
}
