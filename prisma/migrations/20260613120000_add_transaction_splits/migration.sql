-- Add client-side idempotency for transaction creation
ALTER TABLE `Transaction`
  ADD COLUMN `clientMutationId` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `Transaction_userId_clientMutationId_key`
  ON `Transaction`(`userId`, `clientMutationId`);

-- Add line-item split allocations
CREATE TABLE `TransactionSplit` (
  `id` VARCHAR(191) NOT NULL,
  `amount` DOUBLE NOT NULL,
  `description` TEXT NULL,
  `descriptionEncrypted` TEXT NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `transactionId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `categoryId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `TransactionSplit_transactionId_idx`(`transactionId`),
  INDEX `TransactionSplit_userId_idx`(`userId`),
  INDEX `TransactionSplit_categoryId_idx`(`categoryId`),
  INDEX `TransactionSplit_userId_transactionId_idx`(`userId`, `transactionId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `TransactionSplit`
  ADD CONSTRAINT `TransactionSplit_transactionId_fkey`
    FOREIGN KEY (`transactionId`) REFERENCES `Transaction`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `TransactionSplit_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `TransactionSplit_categoryId_fkey`
    FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
