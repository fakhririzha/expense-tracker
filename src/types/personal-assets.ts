export const PERSONAL_ASSET_CATEGORIES = [
  "ELECTRONICS",
  "VEHICLE",
  "PROPERTY",
  "FURNITURE",
  "JEWELRY",
  "COLLECTIBLE",
  "EQUIPMENT",
  "OTHER",
] as const;

export type PersonalAssetCategory = (typeof PERSONAL_ASSET_CATEGORIES)[number];

export const PERSONAL_ASSET_CATEGORY_LABELS: Record<
  PersonalAssetCategory,
  string
> = {
  ELECTRONICS: "Electronics",
  VEHICLE: "Vehicle",
  PROPERTY: "Property",
  FURNITURE: "Furniture",
  JEWELRY: "Jewelry",
  COLLECTIBLE: "Collectible",
  EQUIPMENT: "Equipment",
  OTHER: "Other",
};

export interface PersonalAssetRecord {
  id: string;
  name: string;
  category: PersonalAssetCategory;
  currentValue: number;
  currency: string;
  currentValuedAt: Date;
  purchaseDate: Date | null;
  purchasePrice: number | null;
  purchaseCurrency: string | null;
  notes: string | null;
  disposedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    valuations: number;
  };
}

export interface PersonalAssetValuationRecord {
  id: string;
  value: number;
  currency: string;
  valuedAt: Date;
  createdAt: Date;
}

export interface PersonalAssetSummary {
  totalValue: number;
  activeCount: number;
  archivedCount: number;
  categoryCount: number;
  displayCurrency: string;
}
