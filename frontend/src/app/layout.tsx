import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter, Fraunces } from "next/font/google";
import ToastProvider from "@/components/ToastProvider";
import PwaRegistration from "@/components/PwaRegistration";
import PublicHeader from "@/components/PublicHeader";
import SiteFooter from "@/components/SiteFooter";
import LoginModalHost from "@/components/auth/LoginModalHost";
import LoginModalQuerySync from "@/components/auth/LoginModalQuerySync";
import RegisterModalHost from "@/components/auth/RegisterModalHost";
import { getSiteUrl, absoluteUrl } from "@/lib/seo";
import JsonLd from "@/components/seo/JsonLd";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["SOFT", "WONK"],
});

const siteUrl = getSiteUrl();
const googleVerification = process.env.GOOGLE_SITE_VERIFICATION;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "What2Play | Board Game Night Planner",
    template: "%s | What2Play",
  },
  description:
    "Plan board game nights, gather your group, vote on options, and pick the best game for the table.",
  applicationName: "What2Play",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    title: "What2Play | Board Game Night Planner",
    description:
      "Plan board game nights, gather your group, vote on options, and pick the best game for the table.",
    siteName: "What2Play",
    locale: "en_US",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "What2Play | Board Game Night Planner",
    description:
      "Plan board game nights, gather your group, vote on options, and pick the best game for the table.",
    images: ["/opengraph-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification: googleVerification ? { google: googleVerification } : undefined,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "What2Play",
    statusBarStyle: "default",
  },
  icons: {
    shortcut: "/favicon.ico",
    icon: [
      { url: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      { url: "/meeple-photo-full-64.png", sizes: "64x64", type: "image/png" },
      {
        url: "/meeple-photo-full-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      { url: "/meeple-photo-full.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/meeple-photo-full-192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${fraunces.variable} antialiased`}>
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "What2Play",
            url: absoluteUrl("/"),
            logo: absoluteUrl("/meeple-photo-full-192.png"),
            description:
              "Board game night planner for groups — recommendations, voting, and multi-table seating.",
            sameAs: [],
          }}
        />
        <ToastProvider />
        <PwaRegistration />
        <Suspense fallback={null}>
          <LoginModalQuerySync />
        </Suspense>
        <LoginModalHost />
        <RegisterModalHost />
        <PublicHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
