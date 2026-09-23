type ExchangeRateLookup = (from: string, to: string) => Promise<number | null>;

/** One resolver per posting run, including failed lookups; never call inside a transaction. */
export function createInterestExchangeRateResolver(lookup: ExchangeRateLookup) {
  const rates = new Map<string, Promise<number>>();

  return (from: string, to: string): Promise<number> => {
    if (from === to) return Promise.resolve(1);

    const key = JSON.stringify([from, to]);
    let rate = rates.get(key);
    if (!rate) {
      rate = Promise.resolve().then(async () => {
        const value = await lookup(from, to);
        if (value === null || !Number.isFinite(value) || value <= 0) {
          throw new Error(`Exchange rate unavailable for ${from}/${to}; interest remains due for retry.`);
        }
        return value;
      });
      rates.set(key, rate);
    }
    return rate;
  };
}
