-- AlterTable
ALTER TABLE `Subscription` MODIFY `description` VARCHAR(191) NULL,
    MODIFY `notes` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `TransactionSplit` MODIFY `description` VARCHAR(191) NULL;
