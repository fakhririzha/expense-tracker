import { revalidatePath } from "next/cache";

export function revalidateTransactionPaths(): void {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard/budgets");
  revalidatePath("/dashboard/reports");
}
