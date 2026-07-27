export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertProductionEncryptionConfigured } = await import(
      "@/lib/encryption"
    );
    assertProductionEncryptionConfigured();
  }
}
