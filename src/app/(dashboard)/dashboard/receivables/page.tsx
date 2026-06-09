import { LoansReceivableManager } from "@/components/receivables/LoansReceivableManager";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Loans Receivable | Expense Tracker",
  description: "Track loan principal owed to you",
};

export default function LoansReceivablePage() {
  return <LoansReceivableManager />;
}
