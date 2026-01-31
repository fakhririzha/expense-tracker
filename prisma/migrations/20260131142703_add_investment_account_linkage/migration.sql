-- AlterTable
ALTER TABLE `InvestmentAsset` ADD COLUMN `accountId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `TradeHistory` ADD COLUMN `accountId` VARCHAR(191) NULL,
    ADD COLUMN `balanceAfter` DOUBLE NULL,
    ADD COLUMN `balanceBefore` DOUBLE NULL;

-- CreateIndex
CREATE INDEX `InvestmentAsset_accountId_idx` ON `InvestmentAsset`(`accountId`);

-- CreateIndex
CREATE INDEX `TradeHistory_accountId_idx` ON `TradeHistory`(`accountId`);

-- AddForeignKey
ALTER TABLE `InvestmentAsset` ADD CONSTRAINT `InvestmentAsset_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `FinancialAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TradeHistory` ADD CONSTRAINT `TradeHistory_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `FinancialAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
