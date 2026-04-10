import type { Metadata } from "next";
import JsonLd from "@/components/seo/JsonLd";
import HomeTokenRedirect from "@/components/landing/HomeTokenRedirect";
import { LandingMarketing } from "@/components/landing/LandingMarketing";
import { absoluteUrl, createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Board Game Night Planner and Voting App",
  description:
    "Plan board game nights with recommendations, ranked voting, and multi-table seat optimization for larger events.",
  path: "/",
  keywords: [
    "board game night planner",
    "board game voting app",
    "board game recommendation tool",
    "board game table assignment tool",
    "board game cafe table planner",
    "game night organizer",
    "boardgamegeek collection sync",
    "board game availability poll",
    "board game collection stats",
  ],
});

export default function Home() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "What2Play",
      url: absoluteUrl("/"),
      description:
        "Plan board game nights with recommendations, voting, and multi-table seating optimization.",
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "What2Play",
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Web",
      url: absoluteUrl("/"),
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      featureList: [
        "Board game night planning",
        "Collection-aware recommendations",
        "Ranked voting for game selection",
        "Post-vote multi-table seating optimization",
        "Availability polling for invite-only events",
        "Open event discovery and RSVP",
        "Fallback game options after vote lock-in",
        "BoardGameGeek collection linking",
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "How does What2Play choose board game recommendations?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Recommendations consider player count, duration, complexity, and games your attendees can bring.",
          },
        },
        {
          "@type": "Question",
          name: "Can groups vote on which board game to play?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. You can run ranked voting rounds so the group reaches a fair final choice.",
          },
        },
        {
          "@type": "Question",
          name: "Can What2Play assign players across multiple tables?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. For larger confirmed events, hosts can run a multi-table optimizer that seats as many attendees as possible first, then improves vote and preference fit.",
          },
        },
        {
          "@type": "Question",
          name: "Can I sync my BoardGameGeek collection?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. You can link your BoardGameGeek username and use owned games in planning and recommendation flows.",
          },
        },
        {
          "@type": "Question",
          name: "Can we poll dates before locking a game night?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Hosts can run availability polls for invite-only events, then lock the final date and time.",
          },
        },
        {
          "@type": "Question",
          name: "What happens if attendees drop after voting?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Hosts can set fallback game options so confirmed events can adapt if player count changes before game time.",
          },
        },
      ],
    },
  ] satisfies Record<string, unknown>[];

  return (
    <>
      <JsonLd data={jsonLd} />
      <HomeTokenRedirect />
      <LandingMarketing />
    </>
  );
}
