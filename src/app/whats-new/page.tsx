import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import ReactMarkdown from "react-markdown";

import { MarketingShell } from "@/components/marketing/MarketingShell";

export const metadata: Metadata = {
  title: "What’s New",
  description: "Latest FinHealth product updates and maintenance notes.",
};

export default async function WhatsNewPage() {
  const changelogPath = path.join(process.cwd(), "content", "changelog.md");
  const markdown = await readFile(changelogPath, "utf8");

  return (
    <MarketingShell>
      <main className="px-5 py-14 md:px-8 md:py-20">
        <article className="mx-auto max-w-4xl">
          <header className="border-b-2 border-black pb-10">
            <span className="inline-flex border-2 border-black bg-[#f6ce30] px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] shadow-[2px_2px_0_#000]">WHAT’S NEW</span>
            <h1 className="mt-5 font-heading text-5xl font-black uppercase leading-[0.9] tracking-[-0.06em] sm:text-7xl">Built, improved, and maintained.</h1>
            <p className="mt-6 max-w-2xl text-lg font-bold leading-7 text-black/70">Every FinHealth release in one place.</p>
          </header>
          <div className="marketing-markdown pt-10">
            <ReactMarkdown
              components={{
                h1: ({ children }) => <h2 className="sr-only">{children}</h2>,
                h2: ({ children }) => <h2 className="mt-10 border-b-2 border-black pb-3 font-heading text-3xl font-black tracking-[-0.04em] first:mt-0">{children}</h2>,
                p: ({ children }) => <p className="mt-4 text-base font-semibold leading-7 text-black/75">{children}</p>,
                ul: ({ children }) => <ul className="mt-4 space-y-2 border-l-4 border-[#078443] pl-5 text-base font-semibold leading-7 text-black/75">{children}</ul>,
                li: ({ children }) => <li>{children}</li>,
              }}
            >
              {markdown}
            </ReactMarkdown>
          </div>
        </article>
      </main>
    </MarketingShell>
  );
}
