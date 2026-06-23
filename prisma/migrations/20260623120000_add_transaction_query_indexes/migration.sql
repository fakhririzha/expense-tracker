CREATE INDEX `Transaction_userId_date_idx`
  ON `Transaction`(`userId`, `date`);

CREATE INDEX `Transaction_userId_accountId_date_idx`
  ON `Transaction`(`userId`, `accountId`, `date`);

CREATE INDEX `Transaction_userId_type_date_idx`
  ON `Transaction`(`userId`, `type`, `date`);
