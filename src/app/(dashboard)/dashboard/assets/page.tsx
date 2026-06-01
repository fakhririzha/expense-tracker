import type { Metadata } from "next";

import { PersonalAssetManager } from "@/components/assets/PersonalAssetManager";

export const metadata: Metadata = {
  title: "Personal Assets | Expense Tracker",
  description: "Track owned items and their dated valuations",
};

export default function PersonalAssetsPage() {
  return <PersonalAssetManager />;
}
