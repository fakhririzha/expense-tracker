import prisma from "@/lib/db";

export {
  deriveMobileTransactionCapabilities,
  type TransactionCapabilities,
  type TransactionCapabilityFacts,
} from "@/server/transactions/transaction-capability-policy";

export async function getBankInterestManagedTransactionIds(
  userId: string,
  transactionIds: readonly string[]
): Promise<Set<string>> {
  if (transactionIds.length === 0) return new Set<string>();

  const postings = await prisma.bankInterestPosting.findMany({
    where: { userId, transactionId: { in: [...transactionIds] } },
    select: { transactionId: true },
  });

  return new Set(postings.map((posting) => posting.transactionId));
}
