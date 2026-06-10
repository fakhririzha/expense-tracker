-- CreateTable
CREATE TABLE `PushSubscription` (
    `id` VARCHAR(191) NOT NULL,
    `endpointHash` VARCHAR(191) NOT NULL,
    `endpointEncrypted` TEXT NOT NULL,
    `p256dhEncrypted` TEXT NOT NULL,
    `authEncrypted` TEXT NOT NULL,
    `userAgentEncrypted` TEXT NULL,
    `expirationTime` DATETIME(3) NULL,
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSuccessAt` DATETIME(3) NULL,
    `lastFailureAt` DATETIME(3) NULL,
    `failureCount` INTEGER NOT NULL DEFAULT 0,
    `disabledAt` DATETIME(3) NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PushSubscription_endpointHash_key`(`endpointHash`),
    INDEX `PushSubscription_userId_idx`(`userId`),
    INDEX `PushSubscription_userId_disabledAt_idx`(`userId`, `disabledAt`),
    INDEX `PushSubscription_expirationTime_idx`(`expirationTime`),
    INDEX `PushSubscription_lastFailureAt_idx`(`lastFailureAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NotificationPreference` (
    `id` VARCHAR(191) NOT NULL,
    `pushEnabled` BOOLEAN NOT NULL DEFAULT false,
    `subscriptionRenewalEnabled` BOOLEAN NOT NULL DEFAULT true,
    `recurringTransactionEnabled` BOOLEAN NOT NULL DEFAULT true,
    `budgetThresholdEnabled` BOOLEAN NOT NULL DEFAULT true,
    `lowCashForecastEnabled` BOOLEAN NOT NULL DEFAULT true,
    `monthlySnapshotEnabled` BOOLEAN NOT NULL DEFAULT true,
    `goalProgressEnabled` BOOLEAN NOT NULL DEFAULT true,
    `importExportCompletionEnabled` BOOLEAN NOT NULL DEFAULT false,
    `subscriptionReminderLeadDays` INTEGER NOT NULL DEFAULT 3,
    `recurringReminderLeadDays` INTEGER NOT NULL DEFAULT 1,
    `budgetThresholdPercent` INTEGER NOT NULL DEFAULT 80,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `NotificationPreference_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NotificationEvent` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('TEST', 'SUBSCRIPTION_RENEWAL', 'RECURRING_TRANSACTION_DUE', 'BUDGET_THRESHOLD', 'LOW_CASH_FORECAST', 'MONTHLY_NET_WORTH_SNAPSHOT', 'GOAL_PROGRESS', 'IMPORT_EXPORT_COMPLETION') NOT NULL,
    `dedupeKey` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` VARCHAR(191) NOT NULL,
    `targetPath` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'SENT', 'PARTIAL_FAILURE', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
    `successCount` INTEGER NOT NULL DEFAULT 0,
    `failureCount` INTEGER NOT NULL DEFAULT 0,
    `skippedReason` VARCHAR(191) NULL,
    `metadataJson` JSON NULL,
    `sentAt` DATETIME(3) NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `NotificationEvent_userId_type_dedupeKey_key`(`userId`, `type`, `dedupeKey`),
    INDEX `NotificationEvent_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `NotificationEvent_type_createdAt_idx`(`type`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PushSubscription` ADD CONSTRAINT `PushSubscription_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `NotificationPreference` ADD CONSTRAINT `NotificationPreference_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `NotificationEvent` ADD CONSTRAINT `NotificationEvent_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
