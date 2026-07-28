CREATE TABLE `AccountMutationTotpCredential` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `secretEncrypted` TEXT NOT NULL,
  `enabledAt` DATETIME(3) NULL,
  `lastUsedTimeStep` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `AccountMutationTotpCredential_userId_key`(`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AccountMutationRecoveryCode` (
  `id` VARCHAR(191) NOT NULL,
  `credentialId` VARCHAR(191) NOT NULL,
  `codeHash` CHAR(64) NOT NULL,
  `usedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `AccountMutationRecoveryCode_codeHash_key`(`codeHash`),
  INDEX `AccountMutationRecoveryCode_credentialId_usedAt_idx`(`credentialId`, `usedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AccountMutationTotpCredential`
  ADD CONSTRAINT `AccountMutationTotpCredential_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `AccountMutationRecoveryCode`
  ADD CONSTRAINT `AccountMutationRecoveryCode_credentialId_fkey`
  FOREIGN KEY (`credentialId`) REFERENCES `AccountMutationTotpCredential`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
