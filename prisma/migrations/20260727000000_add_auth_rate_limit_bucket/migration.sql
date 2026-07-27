CREATE TABLE `AuthRateLimitBucket` (
  `id` VARCHAR(191) NOT NULL,
  `scope` VARCHAR(32) NOT NULL,
  `keyHash` CHAR(64) NOT NULL,
  `windowStart` DATETIME(3) NOT NULL,
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `expiresAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `AuthRateLimitBucket_scope_keyHash_windowStart_key`(`scope`, `keyHash`, `windowStart`),
  INDEX `AuthRateLimitBucket_expiresAt_idx`(`expiresAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
