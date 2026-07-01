import { z } from "zod";

import prisma from "@/lib/db";

const PEGADAIAN_GOLD_PRICE_URL = "https://pegadaian.co.id/gold/prices";
const PEGADAIAN_PROVIDER = "PEGADAIAN";
const PEGADAIAN_SOURCE = "TABUNGAN_EMAS";
const PEGADAIAN_SUCCESS_CODE = "2000000100";

const pegadaianGoldPriceResponseSchema = z.object({
  responseCode: z.string(),
  responseDesc: z.string().optional(),
  timestamp: z.string().optional(),
  data: z.object({
    tglBerlaku: z.string().min(1),
    percentageChangeHargaBeli: z.number().nullable().optional(),
    percentageChangeHargaJual: z.number().nullable().optional(),
    id: z.union([z.number(), z.string()]).optional(),
    hargaBeli: z.number(),
    hargaJual: z.number(),
    unit: z.union([z.number(), z.string()]),
    timestamp: z.union([z.number(), z.string()]).optional(),
  }),
  message: z.string().optional(),
});

export interface PegadaianGoldPriceSnapshot {
  id: string;
  provider: string;
  source: string;
  currency: string;
  customerBuyPrice: number;
  customerSellPrice: number;
  customerBuyChangePercent: number | null;
  customerSellChangePercent: number | null;
  unitGram: number;
  effectiveDate: Date;
  sourceUpdatedAt: Date | null;
  fetchedAt: Date;
}

interface NormalizedPegadaianGoldPrice {
  provider: string;
  source: string;
  currency: string;
  customerBuyPrice: number;
  customerSellPrice: number;
  customerBuyChangePercent: number | null;
  customerSellChangePercent: number | null;
  unitGram: number;
  effectiveDate: Date;
  sourceUpdatedAt: Date | null;
}

function parseFiniteNumber(value: string | number, fieldName: string): number {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid Pegadaian gold price field: ${fieldName}`);
  }

  return parsed;
}

function parsePositiveNumber(value: string | number, fieldName: string): number {
  const parsed = parseFiniteNumber(value, fieldName);

  if (parsed <= 0) {
    throw new Error(`Invalid Pegadaian gold price field: ${fieldName}`);
  }

  return parsed;
}

function parseEffectiveDate(value: string): Date {
  const effectiveDate = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(effectiveDate.getTime())) {
    throw new Error("Invalid Pegadaian gold price effective date");
  }

  return effectiveDate;
}

function parseOptionalTimestamp(value?: string | number): Date | null {
  if (value === undefined || value === null || value === "") return null;

  const timestamp = parseFiniteNumber(value, "timestamp");
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid Pegadaian gold price timestamp");
  }

  return date;
}

function mapPegadaianResponse(
  payload: z.infer<typeof pegadaianGoldPriceResponseSchema>
): NormalizedPegadaianGoldPrice {
  if (payload.responseCode !== PEGADAIAN_SUCCESS_CODE) {
    throw new Error(
      payload.message || "Pegadaian gold price request was not approved"
    );
  }

  const data = payload.data;
  const customerBuyPrice = parsePositiveNumber(data.hargaJual, "hargaJual");
  const customerSellPrice = parsePositiveNumber(data.hargaBeli, "hargaBeli");

  return {
    provider: PEGADAIAN_PROVIDER,
    source: PEGADAIAN_SOURCE,
    currency: "IDR",
    customerBuyPrice,
    customerSellPrice,
    customerBuyChangePercent: data.percentageChangeHargaJual ?? null,
    customerSellChangePercent: data.percentageChangeHargaBeli ?? null,
    unitGram: parsePositiveNumber(data.unit, "unit"),
    effectiveDate: parseEffectiveDate(data.tglBerlaku),
    sourceUpdatedAt: parseOptionalTimestamp(data.timestamp),
  };
}

export async function fetchPegadaianGoldPrice(): Promise<NormalizedPegadaianGoldPrice> {
  const response = await fetch(PEGADAIAN_GOLD_PRICE_URL, {
    cache: "no-store",
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Pegadaian gold price request failed: ${response.status}`);
  }

  const payload: unknown = await response.json();
  const parsed = pegadaianGoldPriceResponseSchema.safeParse(payload);

  if (!parsed.success) {
    throw new Error("Invalid Pegadaian gold price response");
  }

  return mapPegadaianResponse(parsed.data);
}

export async function saveLatestPegadaianGoldPriceSnapshot(): Promise<PegadaianGoldPriceSnapshot> {
  const price = await fetchPegadaianGoldPrice();

  return prisma.goldPriceSnapshot.create({
    data: price,
  });
}

export async function getLatestPegadaianGoldPriceSnapshot(): Promise<PegadaianGoldPriceSnapshot | null> {
  return prisma.goldPriceSnapshot.findFirst({
    where: {
      provider: PEGADAIAN_PROVIDER,
      source: PEGADAIAN_SOURCE,
    },
    orderBy: {
      fetchedAt: "desc",
    },
  });
}
