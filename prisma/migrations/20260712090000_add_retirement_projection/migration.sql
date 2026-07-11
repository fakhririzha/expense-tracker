-- Optional personal retirement timeline used to calculate the monthly savings projection.
ALTER TABLE `User`
  ADD COLUMN `dateOfBirth` DATETIME(3) NULL,
  ADD COLUMN `retirementAge` INTEGER NULL;
