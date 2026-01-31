-- AlterTable
ALTER TABLE `Transaction` ADD COLUMN `financialAccountId` VARCHAR(191) NULL,
    ADD COLUMN `toAccountId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `Transaction_toAccountId_idx` ON `Transaction`(`toAccountId`);

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_toAccountId_fkey` FOREIGN KEY (`toAccountId`) REFERENCES `FinancialAccount`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_financialAccountId_fkey` FOREIGN KEY (`financialAccountId`) REFERENCES `FinancialAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
