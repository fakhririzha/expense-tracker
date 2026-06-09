-- CreateTable
CREATE TABLE `NetWorthSnapshot` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `periodYear` INTEGER NOT NULL,
    `periodMonth` INTEGER NOT NULL,
    `snapshotDate` DATETIME(3) NOT NULL,
    `currency` VARCHAR(191) NOT NULL,
    `totalAssets` DECIMAL(20, 4) NOT NULL DEFAULT 0.0000,
    `totalLiabilities` DECIMAL(20, 4) NOT NULL DEFAULT 0.0000,
    `netWorth` DECIMAL(20, 4) NOT NULL DEFAULT 0.0000,
    `cashTotal` DECIMAL(20, 4) NOT NULL DEFAULT 0.0000,
    `bankTotal` DECIMAL(20, 4) NOT NULL DEFAULT 0.0000,
    `investmentCashTotal` DECIMAL(20, 4) NOT NULL DEFAULT 0.0000,
    `investmentHoldingTotal` DECIMAL(20, 4) NOT NULL DEFAULT 0.0000,
    `investmentTotal` DECIMAL(20, 4) NOT NULL DEFAULT 0.0000,
    `personalAssetTotal` DECIMAL(20, 4) NOT NULL DEFAULT 0.0000,
    `receivableTotal` DECIMAL(20, 4) NOT NULL DEFAULT 0.0000,
    `loanLiabilityTotal` DECIMAL(20, 4) NOT NULL DEFAULT 0.0000,
    `creditCardTotal` DECIMAL(20, 4) NOT NULL DEFAULT 0.0000,
    `liabilityOverpayTotal` DECIMAL(20, 4) NOT NULL DEFAULT 0.0000,
    `sourceBreakdownJson` JSON NULL,
    `exchangeRateJson` JSON NULL,
    `calculationVersion` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `NetWorthSnapshot_userId_periodYear_periodMonth_key`(`userId`, `periodYear`, `periodMonth`),
    INDEX `NetWorthSnapshot_userId_snapshotDate_idx`(`userId`, `snapshotDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `NetWorthSnapshot` ADD CONSTRAINT `NetWorthSnapshot_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
