import Link from 'next/link';
import { KEYWORD_CLUSTERS } from '@/lib/keyword-clusters';

export type GuideSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export type GuideFaq = {
  question: string;
  answer: string;
};

type GuideShellProps = {
  title: string;
  keyword: string;
  intro: string;
  sections: GuideSection[];
  relatedPaths: string[];
  faqs?: GuideFaq[];
};

export default function GuideShell({
  title,
  keyword,
  intro,
  sections,
  relatedPaths,
  faqs,
}: GuideShellProps) {
  const relatedClusters = KEYWORD_CLUSTERS.filter((cluster) =>
    relatedPaths.includes(cluster.path),
  );

  return (
    <main className="wt-page px-4 sm:px-6 py-12 sm:py-16">
      <header className="max-w-3xl">
        <p className="wt-chip">{keyword}</p>
        <h1 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight">{title}</h1>
        <p className="mt-4 text-lg wt-muted">{intro}</p>
      </header>

      <section className="mt-10 space-y-6">
        {sections.map((section) => (
          <article key={section.heading} className="wt-card p-6 sm:p-7">
            <h2 className="text-2xl font-semibold">{section.heading}</h2>
            <div className="mt-3 space-y-3">
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="wt-muted leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>
            {section.bullets?.length ? (
              <ul className="mt-4 space-y-2 pl-5 list-disc">
                {section.bullets.map((bullet) => (
                  <li key={bullet} className="wt-muted leading-relaxed">
                    {bullet}
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </section>

      {faqs?.length ? (
        <section className="mt-10">
          <h2 className="text-2xl font-semibold">Frequently asked questions</h2>
          <div className="mt-4 space-y-3">
            {faqs.map((faq) => (
              <details key={faq.question} className="wt-card p-5">
                <summary className="font-semibold">{faq.question}</summary>
                <p className="mt-2 text-sm wt-muted">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-10 wt-card-raised p-6 sm:p-8">
        <h2 className="text-2xl font-semibold">Related guides</h2>
        <ul className="mt-4 grid gap-3 md:grid-cols-2 list-none p-0">
          {relatedClusters.map((cluster) => (
            <li key={cluster.id} className="wt-subtle p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                {cluster.primaryKeyword}
              </p>
              <Link
                href={cluster.path}
                className="mt-2 block font-semibold text-[var(--foreground)] hover:text-[var(--primary)]"
              >
                {cluster.pageTitle}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/resources" className="wt-btn wt-btn-secondary px-5 py-2.5 no-underline text-[var(--foreground)]">
            Browse all resources
          </Link>
          <Link href="/?m=register" className="wt-btn wt-btn-primary px-5 py-2.5 no-underline text-white">
            Start with What2Play
          </Link>
        </div>
      </section>
    </main>
  );
}
