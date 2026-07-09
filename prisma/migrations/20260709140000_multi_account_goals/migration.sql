-- Multi-account savings goals: progress derived from linked account balances.

CREATE TABLE `SavingsGoalAccount` (
  `goalId` VARCHAR(191) NOT NULL,
  `accountId` VARCHAR(191) NOT NULL,

  INDEX `SavingsGoalAccount_goalId_idx`(`goalId`),
  INDEX `SavingsGoalAccount_accountId_idx`(`accountId`),
  PRIMARY KEY (`goalId`, `accountId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `SavingsGoalAccount`
  ADD CONSTRAINT `SavingsGoalAccount_goalId_fkey`
    FOREIGN KEY (`goalId`) REFERENCES `SavingsGoal`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `SavingsGoalAccount_accountId_fkey`
    FOREIGN KEY (`accountId`) REFERENCES `FinancialAccount`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve existing single-account links
INSERT INTO `SavingsGoalAccount` (`goalId`, `accountId`)
SELECT `id`, `accountId`
FROM `SavingsGoal`
WHERE `accountId` IS NOT NULL;

-- Drop legacy single-account FK and columns
ALTER TABLE `SavingsGoal`
  DROP FOREIGN KEY `SavingsGoal_accountId_fkey`;

DROP INDEX `SavingsGoal_accountId_idx` ON `SavingsGoal`;

ALTER TABLE `SavingsGoal`
  DROP COLUMN `accountId`,
  DROP COLUMN `currentAmount`,
  DROP COLUMN `isCompleted`;
