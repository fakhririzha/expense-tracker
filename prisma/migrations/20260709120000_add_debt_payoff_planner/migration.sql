-- Debt Payoff Planner: strategy inputs linked to liability accounts.
CREATE TABLE `DebtPlan` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL DEFAULT 'My debt payoff plan',
    `strategy` ENUM('AVALANCHE', 'SNOWBALL', 'CUSTOM') NOT NULL DEFAULT 'AVALANCHE',
    `extraMonthlyAmount` DOUBLE NOT NULL DEFAULT 0,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'IDR',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DebtPlan_userId_idx`(`userId`),
    INDEX `DebtPlan_userId_isActive_idx`(`userId`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DebtPlanItem` (
    `id` VARCHAR(191) NOT NULL,
    `annualInterestRate` DOUBLE NOT NULL,
    `minimumPayment` DOUBLE NOT NULL,
    `priorityOverride` INTEGER NULL,
    `paymentDayOfMonth` INTEGER NOT NULL DEFAULT 1,
    `debtPlanId` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DebtPlanItem_debtPlanId_accountId_key`(`debtPlanId`, `accountId`),
    INDEX `DebtPlanItem_debtPlanId_idx`(`debtPlanId`),
    INDEX `DebtPlanItem_accountId_idx`(`accountId`),
    INDEX `DebtPlanItem_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DebtPlan`
  ADD CONSTRAINT `DebtPlan_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `DebtPlanItem`
  ADD CONSTRAINT `DebtPlanItem_debtPlanId_fkey`
    FOREIGN KEY (`debtPlanId`) REFERENCES `DebtPlan`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `DebtPlanItem_accountId_fkey`
    FOREIGN KEY (`accountId`) REFERENCES `FinancialAccount`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `DebtPlanItem_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
