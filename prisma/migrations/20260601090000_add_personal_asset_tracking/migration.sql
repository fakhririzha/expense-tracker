-- CreateTable
CREATE TABLE `PersonalAsset` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameEncrypted` TEXT NULL,
    `category` ENUM('ELECTRONICS', 'VEHICLE', 'PROPERTY', 'FURNITURE', 'JEWELRY', 'COLLECTIBLE', 'EQUIPMENT', 'OTHER') NOT NULL,
    `currentValue` DOUBLE NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'IDR',
    `currentValuedAt` DATETIME(3) NOT NULL,
    `purchaseDate` DATETIME(3) NULL,
    `purchasePrice` DOUBLE NULL,
    `purchaseCurrency` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `notesEncrypted` TEXT NULL,
    `disposedAt` DATETIME(3) NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PersonalAsset_userId_idx`(`userId`),
    INDEX `PersonalAsset_userId_disposedAt_idx`(`userId`, `disposedAt`),
    INDEX `PersonalAsset_userId_category_idx`(`userId`, `category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PersonalAssetValuation` (
    `id` VARCHAR(191) NOT NULL,
    `value` DOUBLE NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'IDR',
    `valuedAt` DATETIME(3) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PersonalAssetValuation_assetId_valuedAt_idx`(`assetId`, `valuedAt`),
    INDEX `PersonalAssetValuation_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PersonalAsset` ADD CONSTRAINT `PersonalAsset_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PersonalAssetValuation` ADD CONSTRAINT `PersonalAssetValuation_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `PersonalAsset`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PersonalAssetValuation` ADD CONSTRAINT `PersonalAssetValuation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
