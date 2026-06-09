import type { Metadata } from "next";

import { SubscriptionManager } from "@/components/subscriptions/SubscriptionManager";

export const metadata: Metadata = {
  title: "Subscriptions | Expense Tracker",
  description: "Track recurring memberships, trials, and subscription spending",
};

export default function SubscriptionsPage() {
  return <SubscriptionManager />;
}
