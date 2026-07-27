import prisma from "@/lib/db";

export async function getManagedDepositoTransactionIds(
  userId: string
): Promise<Set<string>> {
  const [depositos, postings] = await Promise.all([
    prisma.depositoAccount.findMany({
      where: { userId },
      select: {
        openingTransactionId: true,
        closingTransactionId: true,
      },
    }),
    prisma.depositoInterestPosting.findMany({
      where: { depositoAccount: { userId } },
      select: { transactionId: true },
    }),
  ]);

  const ids = new Set<string>();
  for (const deposito of depositos) {
    if (deposito.openingTransactionId) ids.add(deposito.openingTransactionId);
    if (deposito.closingTransactionId) ids.add(deposito.closingTransactionId);
  }
  for (const posting of postings) ids.add(posting.transactionId);

  return ids;
}

export async function isManagedDepositoTransaction(
  userId: string,
  transactionId: string
): Promise<boolean> {
  const [deposito, posting] = await Promise.all([
    prisma.depositoAccount.findFirst({
      where: {
        userId,
        OR: [
          { openingTransactionId: transactionId },
          { closingTransactionId: transactionId },
        ],
      },
      select: { id: true },
    }),
    prisma.depositoInterestPosting.findFirst({
      where: { transactionId, depositoAccount: { userId } },
      select: { id: true },
    }),
  ]);

  return Boolean(deposito || posting);
}
