import type { Metadata } from "next";
import GuideShell, {
  type GuideFaq,
  type GuideSection,
} from "@/components/seo/GuideShell";
import JsonLd from "@/components/seo/JsonLd";
import { getKeywordCluster } from "@/lib/keyword-clusters";
import { absoluteUrl, createPageMetadata } from "@/lib/seo";

const cluster = getKeywordCluster("board-game-shelf-parser");

export const metadata: Metadata = createPageMetadata({
  title: cluster.pageTitle,
  description: cluster.metaDescription,
  path: cluster.path,
  keywords: [
    cluster.primaryKeyword,
    "board game photo parser",
    "board game shelf scan app",
    "board game collection scanner app",
    "photo to board game list",
    "board game OCR and vision parser",
  ],
});

const sections: GuideSection[] = [
  {
    heading: "Why shelf parsing needs more than plain OCR",
    paragraphs: [
      "Game shelves are hard: narrow spines, partial occlusion, rotated text, and visually similar boxes. OCR alone misses too much on dense shelves.",
      "A practical board game shelf parser combines object detection and text reading so it can detect boxes first and then improve title certainty.",
    ],
  },
  {
    heading: "How What2Play parses shelf photos",
    paragraphs: [
      "What2Play runs multiple detection passes in parallel: Gemini upright detection, Claude shelf detection, and a Gemini spine-focused pass for narrow vertical titles.",
      "After that, OCR text blocks are used as supplemental signals, then merged and deduplicated before catalog matching.",
    ],
    bullets: [
      "Parallel Gemini + Claude box detection for broad coverage",
      "Spine-focused scan for vertical and hard-to-read shelf edges",
      "OCR supplemental title capture when detection confidence is low",
      "Overlap suppression and deduplication before candidate matching",
      "BoardGameGeek and local catalog matching for usable imports",
    ],
  },
  {
    heading: "Use this as a board game collection scanner app",
    paragraphs: [
      "As a board game shelf scan app, parsing is most useful when it feeds recommendations and voting immediately. Imported titles should flow straight into candidate generation for new events.",
      "This turns a shelf photo into a board game list you can actually use in planning, rather than a standalone scan result.",
    ],
    bullets: [
      "Add newly detected games before opening event voting",
      "Combine shelf parsing with BGG sync for better inventory coverage",
      "Use AI re-ranking and host overrides after import",
    ],
  },
];

const faqs: GuideFaq[] = [
  {
    question: "Is shelf parsing only OCR?",
    answer:
      "No. What2Play combines Gemini and Claude detection passes, a spine-focused scan, and OCR supplemental matching before dedupe and catalog lookup.",
  },
  {
    question: "Can it handle spine-out shelves?",
    answer:
      "Yes. A dedicated spine-focused pass targets narrow vertical titles that are often missed by standard upright scans.",
  },
  {
    question: "Do I still need BoardGameGeek sync?",
    answer:
      "BGG sync and shelf parsing work best together. BGG covers linked collections, while shelf parsing helps with newly added or unsynced titles.",
  },
  {
    question: "Can this turn a shelf photo into a board game list?",
    answer:
      "Yes. The parser converts shelf photos into import-ready candidates, then matches them to your local and BGG-backed catalog for a usable game list.",
  },
  {
    question: "Can hosts edit results after parsing?",
    answer:
      "Yes. Hosts can review parsed candidates, adjust final game lists, and then run recommendations and voting with those updates.",
  },
];

export default function BoardGameShelfParserPage() {
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
        "Shelf photo parsing with Gemini + Claude detection",
        "Spine-focused scan for narrow vertical titles",
        "OCR supplemental title matching and dedupe",
        "Catalog matching for import-ready game candidates",
        "Photo-to-board-game-list workflow for event planning",
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
        intro="Use a board game shelf parser to turn shelf photos into import-ready game candidates with multi-stage detection, matching, and dedupe."
        sections={sections}
        faqs={faqs}
        relatedPaths={[
          "/boardgamegeek-collection-sync",
          "/board-game-recommendation-tool",
          "/board-game-night-planner",
          "/how-to-plan-a-board-game-night",
        ]}
      />
    </>
  );
}
