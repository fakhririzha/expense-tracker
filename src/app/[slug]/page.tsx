import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MarketingContentPage } from "@/components/marketing/MarketingContentPage";
import {
  MARKETING_PAGES,
  MARKETING_PAGE_SLUGS,
  type MarketingPageSlug,
} from "@/lib/marketing-content";

interface MarketingRouteProps {
  params: Promise<{ slug: string }>;
}

function getMarketingPage(slug: string) {
  if (!MARKETING_PAGE_SLUGS.includes(slug as MarketingPageSlug)) {
    return null;
  }

  return MARKETING_PAGES[slug as MarketingPageSlug];
}

export function generateStaticParams() {
  return MARKETING_PAGE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: MarketingRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getMarketingPage(slug);

  if (!page) {
    return {};
  }

  return {
    title: page.eyebrow.replace(" DRAFT", ""),
    description: page.summary,
  };
}

export default async function MarketingPage({ params }: MarketingRouteProps) {
  const { slug } = await params;
  const page = getMarketingPage(slug);

  if (!page) {
    notFound();
  }

  return <MarketingContentPage page={page} />;
}
