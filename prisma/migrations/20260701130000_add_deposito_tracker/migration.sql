ALTER TABLE `FinancialAccount` MODIFY `type` ENUM('BANK', 'CASH', 'INVESTMENT', 'DEPOSITO', 'LOAN', 'CREDIT_CARD', 'LOAN_RECEIVABLE') NOT NULL;

CREATE TABLE `DepositoAccount` (
    `id` VARCHAR(191) NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `principalAmount` DOUBLE NOT NULL,
    `interestFrequency` ENUM('DAILY', 'MONTHLY', 'YEARLY') NOT NULL,
    `interestRate` DOUBLE NOT NULL,
    `taxRate` DOUBLE NULL,
    `termMode` ENUM('OPEN_ENDED', 'FIXED_TERM') NOT NULL DEFAULT 'OPEN_ENDED',
    `maturityDate` DATETIME(3) NULL,
    `nextInterestDate` DATETIME(3) NULL,
    `status` ENUM('ACTIVE', 'MATURED', 'CLOSED') NOT NULL DEFAULT 'ACTIVE',
    `closedAt` DATETIME(3) NULL,
    `userId` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `openingTransactionId` VARCHAR(191) NULL,
    `closingTransactionId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DepositoAccount_accountId_key`(`accountId`),
    UNIQUE INDEX `DepositoAccount_openingTransactionId_key`(`openingTransactionId`),
    UNIQUE INDEX `DepositoAccount_closingTransactionId_key`(`closingTransactionId`),
    INDEX `DepositoAccount_userId_idx`(`userId`),
    INDEX `DepositoAccount_status_nextInterestDate_idx`(`status`, `nextInterestDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DepositoInterestPosting` (
    `id` VARCHAR(191) NOT NULL,
    `postingDate` DATETIME(3) NOT NULL,
    `grossInterest` DOUBLE NOT NULL,
    `taxAmount` DOUBLE NOT NULL DEFAULT 0,
    `netInterest` DOUBLE NOT NULL,
    `balanceBefore` DOUBLE NOT NULL,
    `balanceAfter` DOUBLE NOT NULL,
    `depositoAccountId` VARCHAR(191) NOT NULL,
    `transactionId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `DepositoInterestPosting_transactionId_key`(`transactionId`),
    UNIQUE INDEX `DepositoInterestPosting_depositoAccountId_postingDate_key`(`depositoAccountId`, `postingDate`),
    INDEX `DepositoInterestPosting_depositoAccountId_postingDate_idx`(`depositoAccountId`, `postingDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DepositoAccount`
    ADD CONSTRAINT `DepositoAccount_userId_fkey`
        FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `DepositoAccount_accountId_fkey`
        FOREIGN KEY (`accountId`) REFERENCES `FinancialAccount`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `DepositoAccount_openingTransactionId_fkey`
        FOREIGN KEY (`openingTransactionId`) REFERENCES `Transaction`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT `DepositoAccount_closingTransactionId_fkey`
        FOREIGN KEY (`closingTransactionId`) REFERENCES `Transaction`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `DepositoInterestPosting`
    ADD CONSTRAINT `DepositoInterestPosting_depositoAccountId_fkey`
        FOREIGN KEY (`depositoAccountId`) REFERENCES `DepositoAccount`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `DepositoInterestPosting_transactionId_fkey`
        FOREIGN KEY (`transactionId`) REFERENCES `Transaction`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
