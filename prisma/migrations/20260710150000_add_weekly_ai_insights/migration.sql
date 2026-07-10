ALTER TABLE `NotificationPreference`
  ADD COLUMN `weeklyAiInsightEnabled` BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE `NotificationEvent`
  MODIFY `type` ENUM(
    'TEST',
    'SUBSCRIPTION_RENEWAL',
    'RECURRING_TRANSACTION_DUE',
    'BUDGET_THRESHOLD',
    'LOW_CASH_FORECAST',
    'MONTHLY_NET_WORTH_SNAPSHOT',
    'GOAL_PROGRESS',
    'IMPORT_EXPORT_COMPLETION',
    'WEEKLY_AI_INSIGHT'
  ) NOT NULL;

CREATE TABLE `WeeklyAiInsight` (
  `id` VARCHAR(191) NOT NULL,
  `periodStart` DATETIME(3) NOT NULL,
  `periodEnd` DATETIME(3) NOT NULL,
  `previousPeriodStart` DATETIME(3) NULL,
  `previousPeriodEnd` DATETIME(3) NULL,
  `status` ENUM('PENDING', 'GENERATED', 'FAILED') NOT NULL DEFAULT 'PENDING',
  `contentEncrypted` TEXT NULL,
  `model` VARCHAR(191) NULL,
  `promptVersion` VARCHAR(191) NULL,
  `failureReason` VARCHAR(191) NULL,
  `generatedAt` DATETIME(3) NULL,
  `userId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `WeeklyAiInsight_userId_periodStart_key`(`userId`, `periodStart`),
  INDEX `WeeklyAiInsight_userId_periodStart_idx`(`userId`, `periodStart`),
  INDEX `WeeklyAiInsight_userId_status_periodStart_idx`(`userId`, `status`, `periodStart`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `WeeklyAiInsight`
  ADD CONSTRAINT `WeeklyAiInsight_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
