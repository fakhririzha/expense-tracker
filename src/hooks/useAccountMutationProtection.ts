import { useQuery } from "@tanstack/react-query";

import { getAccountMutationProtectionStatus } from "@/actions/profile-actions";

export const accountMutationProtectionKeys = {
  all: ["account-mutation-protection"] as const,
};

export function useAccountMutationProtection() {
  return useQuery({
    queryKey: accountMutationProtectionKeys.all,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    queryFn: async () => {
      const result = await getAccountMutationProtectionStatus();
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
  });
}
