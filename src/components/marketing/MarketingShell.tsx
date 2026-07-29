import type { ReactNode } from "react";

import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#fcfcf8] text-black selection:bg-[#f6ce30] selection:text-black">
      <MarketingHeader />
      {children}
      <MarketingFooter />
    </div>
  );
}
