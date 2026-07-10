-- Persist guided setup progress per authenticated user.

CREATE TABLE `UserOnboardingState` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `selectedGoal` VARCHAR(191) NULL,
  `hasSeenWelcome` BOOLEAN NOT NULL DEFAULT false,
  `hasCompletedMainTour` BOOLEAN NOT NULL DEFAULT false,
  `hasSkippedOnboarding` BOOLEAN NOT NULL DEFAULT false,
  `checklistState` JSON NULL,
  `lastTourStep` INTEGER NULL,
  `tourVersion` VARCHAR(191) NOT NULL DEFAULT 'guided-setup-v1',
  `completedAt` DATETIME(3) NULL,
  `skippedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `UserOnboardingState_userId_key`(`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `UserOnboardingState`
  ADD CONSTRAINT `UserOnboardingState_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
