ALTER TABLE `FinancialAccount`
  MODIFY `nameEncrypted` TEXT NOT NULL,
  DROP COLUMN `name`,
  DROP COLUMN `description`;
