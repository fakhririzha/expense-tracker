import { Metadata } from "next";

import { DepositoManager } from "@/components/deposito/DepositoManager";

export const metadata: Metadata = {
  title: "Deposito Tracker | Expense Tracker",
  description: "Track locked deposito balances, schedules, and maturity status",
};

export default function DepositoPage() {
  return <DepositoManager />;
}
