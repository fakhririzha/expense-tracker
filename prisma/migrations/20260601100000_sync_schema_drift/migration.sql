-- AlterTable
ALTER TABLE `Category` MODIFY `type` ENUM('INCOME', 'EXPENSE', 'TRANSFER', 'LIABILITY_PAYMENT') NOT NULL;

-- AlterTable
ALTER TABLE `FinancialAccount` ADD COLUMN `descriptionEncrypted` TEXT NULL,
    ADD COLUMN `lastEncryptedAt` DATETIME(3) NULL,
    ADD COLUMN `nameEncrypted` TEXT NULL;

-- AlterTable
ALTER TABLE `InvestmentAsset` ADD COLUMN `unitType` ENUM('UNIT', 'TROY_OUNCE', 'GRAM') NOT NULL DEFAULT 'UNIT';

-- AlterTable
ALTER TABLE `LiabilityPaymentAudit` ADD COLUMN `ipAddressEncrypted` TEXT NULL,
    ADD COLUMN `userAgentEncrypted` TEXT NULL;

-- AlterTable
ALTER TABLE `RecurringRule` ADD COLUMN `descriptionEncrypted` TEXT NULL,
    ADD COLUMN `nameEncrypted` TEXT NULL,
    MODIFY `type` ENUM('INCOME', 'EXPENSE', 'TRANSFER', 'LIABILITY_PAYMENT') NOT NULL;

-- AlterTable
ALTER TABLE `TradeHistory` ADD COLUMN `notesEncrypted` TEXT NULL,
    ADD COLUMN `unitType` ENUM('UNIT', 'TROY_OUNCE', 'GRAM') NOT NULL DEFAULT 'UNIT';

-- AlterTable
ALTER TABLE `Transaction` ADD COLUMN `createdByEncrypted` TEXT NULL,
    ADD COLUMN `descriptionEncrypted` TEXT NULL,
    ADD COLUMN `referenceNumberEncrypted` TEXT NULL;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `encryptionSalt` TEXT NULL,
    ADD COLUMN `encryptionVersion` INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE `Budget` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `period` ENUM('MONTHLY', 'QUARTERLY', 'YEARLY') NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `categoryId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Budget_userId_idx`(`userId`),
    INDEX `Budget_categoryId_idx`(`categoryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SavingsGoal` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameEncrypted` TEXT NULL,
    `targetAmount` DOUBLE NOT NULL,
    `currentAmount` DOUBLE NOT NULL DEFAULT 0,
    `targetDate` DATETIME(3) NULL,
    `icon` VARCHAR(191) NULL,
    `color` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `descriptionEncrypted` TEXT NULL,
    `isCompleted` BOOLEAN NOT NULL DEFAULT false,
    `accountId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SavingsGoal_userId_idx`(`userId`),
    INDEX `SavingsGoal_accountId_idx`(`accountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `LiabilityPaymentAudit_transactionId_idx` ON `LiabilityPaymentAudit`(`transactionId`);

-- AddForeignKey
ALTER TABLE `Budget` ADD CONSTRAINT `Budget_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Budget` ADD CONSTRAINT `Budget_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SavingsGoal` ADD CONSTRAINT `SavingsGoal_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `FinancialAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SavingsGoal` ADD CONSTRAINT `SavingsGoal_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
