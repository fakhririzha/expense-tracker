-- CreateTable
CREATE TABLE `BankInterestSetting` (
    `id` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `annualRate` DOUBLE NOT NULL,
    `frequency` ENUM('DAILY', 'MONTHLY', 'YEARLY') NOT NULL,
    `enabledAt` DATETIME(3) NULL,
    `nextPostingDate` DATETIME(3) NULL,
    `userId` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BankInterestSetting_userId_idx`(`userId`),
    INDEX `BankInterestSetting_enabled_nextPostingDate_idx`(`enabled`, `nextPostingDate`),
    UNIQUE INDEX `BankInterestSetting_accountId_key`(`accountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BankInterestPosting` (
    `id` VARCHAR(191) NOT NULL,
    `postingDate` DATETIME(3) NOT NULL,
    `annualRate` DOUBLE NOT NULL,
    `balanceBefore` DOUBLE NOT NULL,
    `interestAmount` DOUBLE NOT NULL,
    `balanceAfter` DOUBLE NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `transactionId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BankInterestPosting_userId_idx`(`userId`),
    INDEX `BankInterestPosting_accountId_postingDate_idx`(`accountId`, `postingDate`),
    UNIQUE INDEX `BankInterestPosting_transactionId_key`(`transactionId`),
    UNIQUE INDEX `BankInterestPosting_accountId_postingDate_key`(`accountId`, `postingDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BankInterestSetting` ADD CONSTRAINT `BankInterestSetting_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BankInterestSetting` ADD CONSTRAINT `BankInterestSetting_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `FinancialAccount`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BankInterestPosting` ADD CONSTRAINT `BankInterestPosting_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BankInterestPosting` ADD CONSTRAINT `BankInterestPosting_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `FinancialAccount`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BankInterestPosting` ADD CONSTRAINT `BankInterestPosting_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `Transaction`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
