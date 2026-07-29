import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";

import type { MarketingPageDefinition } from "@/lib/marketing-content";
import { MarketingShell } from "@/components/marketing/MarketingShell";

export function MarketingContentPage({ page }: { page: MarketingPageDefinition }) {
  return (
    <MarketingShell>
      <main className="px-5 py-14 md:px-8 md:py-20">
        <article className="mx-auto max-w-5xl">
          <header className="border-b-2 border-black pb-10">
            <span className="inline-flex border-2 border-black bg-[#f6ce30] px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] shadow-[2px_2px_0_#000]">
              {page.eyebrow}
            </span>
            <h1 className="mt-5 max-w-4xl font-heading text-5xl font-black uppercase leading-[0.9] tracking-[-0.06em] sm:text-7xl">
              {page.title}
            </h1>
            <p className="mt-6 max-w-2xl text-lg font-bold leading-7 text-black/70">
              {page.summary}
            </p>
            {page.isLegal && (
              <p className="mt-6 max-w-2xl border-2 border-black bg-[#fff3bc] p-4 text-sm font-bold leading-5">
                Draft for review: this page is a product-specific plain-language summary, not legal advice or final legal terms.
              </p>
            )}
          </header>

          <div className="divide-y-2 divide-black">
            {page.sections.map((section) => (
              <section key={section.title} className="grid gap-5 py-10 md:grid-cols-[0.75fr_1.25fr]">
                <h2 className="font-heading text-3xl font-black uppercase leading-7">{section.title}</h2>
                <div className="space-y-4 text-base font-semibold leading-7 text-black/75">
                  {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                  {section.bullets && (
                    <ul className="space-y-2 border-l-4 border-[#078443] pl-5">
                      {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                    </ul>
                  )}
                </div>
              </section>
            ))}
          </div>

          {page.eyebrow === "CONTACT" || page.eyebrow === "HELP CENTER" ? (
            <a
              href="https://github.com/fakhririzha/expense-tracker/issues"
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-2 border-2 border-black bg-black px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-white shadow-[4px_4px_0_#000] transition-transform hover:translate-x-px hover:translate-y-px hover:shadow-[3px_3px_0_#000]"
            >
              Open GitHub Issues <ExternalLink className="size-4" />
            </a>
          ) : (
            <Link
              href="/register"
              className="mt-2 inline-flex items-center gap-2 border-2 border-black bg-black px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-white shadow-[4px_4px_0_#000] transition-transform hover:translate-x-px hover:translate-y-px hover:shadow-[3px_3px_0_#000]"
            >
              Get started free <ArrowRight className="size-4" />
            </Link>
          )}
        </article>
      </main>
    </MarketingShell>
  );
}
