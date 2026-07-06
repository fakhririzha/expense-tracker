-- Add multi-category support for budgets while preserving category-less legacy budgets.
ALTER TABLE `Budget`
  ADD COLUMN `scope` ENUM('CATEGORIES', 'LEGACY_GLOBAL') NOT NULL DEFAULT 'CATEGORIES';

CREATE TABLE `BudgetCategory` (
  `budgetId` VARCHAR(191) NOT NULL,
  `categoryId` VARCHAR(191) NOT NULL,

  INDEX `BudgetCategory_budgetId_idx`(`budgetId`),
  INDEX `BudgetCategory_categoryId_idx`(`categoryId`),
  PRIMARY KEY (`budgetId`, `categoryId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `BudgetCategory`
  ADD CONSTRAINT `BudgetCategory_budgetId_fkey`
    FOREIGN KEY (`budgetId`) REFERENCES `Budget`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `BudgetCategory_categoryId_fkey`
    FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO `BudgetCategory` (`budgetId`, `categoryId`)
SELECT `id`, `categoryId`
FROM `Budget`
WHERE `categoryId` IS NOT NULL;

UPDATE `Budget`
SET `scope` = 'LEGACY_GLOBAL'
WHERE `categoryId` IS NULL;

ALTER TABLE `Budget`
  DROP FOREIGN KEY `Budget_categoryId_fkey`;

DROP INDEX `Budget_categoryId_idx` ON `Budget`;

ALTER TABLE `Budget`
  DROP COLUMN `categoryId`;
