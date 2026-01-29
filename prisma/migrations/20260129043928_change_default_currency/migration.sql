-- AlterTable
ALTER TABLE `FinancialAccount` MODIFY `currency` VARCHAR(191) NOT NULL DEFAULT 'IDR';

-- AlterTable
ALTER TABLE `InvestmentAsset` MODIFY `currency` VARCHAR(191) NOT NULL DEFAULT 'IDR';

-- AlterTable
ALTER TABLE `RecurringRule` MODIFY `currency` VARCHAR(191) NOT NULL DEFAULT 'IDR';

-- AlterTable
ALTER TABLE `Transaction` MODIFY `currency` VARCHAR(191) NOT NULL DEFAULT 'IDR';

-- AlterTable
ALTER TABLE `User` MODIFY `mainCurrency` VARCHAR(191) NOT NULL DEFAULT 'IDR';
