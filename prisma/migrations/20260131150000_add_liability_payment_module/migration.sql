-- AlterTable
ALTER TABLE `Transaction` ADD COLUMN `referenceNumber` VARCHAR(191) NULL,
    ADD COLUMN `isOverpayment` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `paymentStatus` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'ROLLED_BACK') NOT NULL DEFAULT 'COMPLETED',
    ADD COLUMN `createdBy` VARCHAR(191) NULL,
    ADD COLUMN `processedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX `Transaction_referenceNumber_key` ON `Transaction`(`referenceNumber`);
CREATE INDEX `Transaction_referenceNumber_idx` ON `Transaction`(`referenceNumber`);

-- CreateTable
CREATE TABLE `LiabilityPaymentAudit` (
    `id` VARCHAR(191) NOT NULL,
    `transactionId` VARCHAR(191) NOT NULL,
    `sourceAccountId` VARCHAR(191) NOT NULL,
    `sourceBalanceBefore` DOUBLE NOT NULL,
    `sourceBalanceAfter` DOUBLE NOT NULL,
    `targetAccountId` VARCHAR(191) NOT NULL,
    `targetBalanceBefore` DOUBLE NOT NULL,
    `targetBalanceAfter` DOUBLE NOT NULL,
    `paymentAmount` DOUBLE NOT NULL,
    `currency` VARCHAR(191) NOT NULL,
    `exchangeRate` DOUBLE NOT NULL,
    `executedBy` VARCHAR(191) NOT NULL,
    `executedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `isRolledBack` BOOLEAN NOT NULL DEFAULT false,
    `rolledBackAt` DATETIME(3) NULL,
    `rollbackReason` VARCHAR(191) NULL,

    UNIQUE INDEX `LiabilityPaymentAudit_transactionId_key`(`transactionId`),
    INDEX `LiabilityPaymentAudit_executedBy_idx`(`executedBy`),
    INDEX `LiabilityPaymentAudit_executedAt_idx`(`executedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `LiabilityPaymentAudit` ADD CONSTRAINT `LiabilityPaymentAudit_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `Transaction`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Update the Transaction type enum
ALTER TABLE `Transaction` MODIFY COLUMN `type` ENUM('INCOME', 'EXPENSE', 'TRANSFER', 'LIABILITY_PAYMENT') NOT NULL;
