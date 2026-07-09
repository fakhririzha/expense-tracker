-- Track accepted bill-photo OCR processing attempts for daily per-user quota enforcement.

CREATE TABLE `OcrUsageEvent` (
  `id` VARCHAR(191) NOT NULL,
  `processedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `imageBytes` INTEGER NULL,
  `userId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `OcrUsageEvent_userId_processedAt_idx`(`userId`, `processedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `OcrUsageEvent`
  ADD CONSTRAINT `OcrUsageEvent_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
