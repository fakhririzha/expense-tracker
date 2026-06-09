-- CreateTable
CREATE TABLE `Subscription` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameEncrypted` TEXT NULL,
    `provider` VARCHAR(191) NULL,
    `providerEncrypted` TEXT NULL,
    `description` TEXT NULL,
    `descriptionEncrypted` TEXT NULL,
    `amount` DOUBLE NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'IDR',
    `billingCycle` ENUM('WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY') NOT NULL,
    `nextBillingDate` DATETIME(3) NOT NULL,
    `startDate` DATETIME(3) NULL,
    `trialEndDate` DATETIME(3) NULL,
    `cancellationDate` DATETIME(3) NULL,
    `status` ENUM('ACTIVE', 'TRIAL', 'PAUSED', 'CANCELLED', 'EXPIRED') NOT NULL,
    `cancellationUrl` TEXT NULL,
    `cancellationUrlEncrypted` TEXT NULL,
    `notes` TEXT NULL,
    `notesEncrypted` TEXT NULL,
    `categoryId` VARCHAR(191) NULL,
    `accountId` VARCHAR(191) NULL,
    `recurringRuleId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Subscription_recurringRuleId_key`(`recurringRuleId`),
    INDEX `Subscription_userId_idx`(`userId`),
    INDEX `Subscription_userId_status_idx`(`userId`, `status`),
    INDEX `Subscription_userId_nextBillingDate_idx`(`userId`, `nextBillingDate`),
    INDEX `Subscription_userId_trialEndDate_idx`(`userId`, `trialEndDate`),
    INDEX `Subscription_accountId_idx`(`accountId`),
    INDEX `Subscription_categoryId_idx`(`categoryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `FinancialAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_recurringRuleId_fkey` FOREIGN KEY (`recurringRuleId`) REFERENCES `RecurringRule`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
