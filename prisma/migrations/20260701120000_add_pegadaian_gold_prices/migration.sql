CREATE TABLE `GoldPriceSnapshot` (
  `id` VARCHAR(191) NOT NULL,
  `provider` VARCHAR(191) NOT NULL,
  `source` VARCHAR(191) NOT NULL,
  `currency` VARCHAR(191) NOT NULL DEFAULT 'IDR',
  `customerBuyPrice` DOUBLE NOT NULL,
  `customerSellPrice` DOUBLE NOT NULL,
  `customerBuyChangePercent` DOUBLE NULL,
  `customerSellChangePercent` DOUBLE NULL,
  `unitGram` DOUBLE NOT NULL,
  `effectiveDate` DATETIME(3) NOT NULL,
  `sourceUpdatedAt` DATETIME(3) NULL,
  `fetchedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `GoldPriceSnapshot_provider_source_fetchedAt_idx`
  ON `GoldPriceSnapshot`(`provider`, `source`, `fetchedAt`);

CREATE INDEX `GoldPriceSnapshot_provider_source_effectiveDate_idx`
  ON `GoldPriceSnapshot`(`provider`, `source`, `effectiveDate`);
