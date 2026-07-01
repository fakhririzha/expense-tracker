UPDATE `DepositoAccount`
SET `interestRate` = CASE `interestFrequency`
  WHEN 'DAILY' THEN `interestRate` * 365
  WHEN 'MONTHLY' THEN `interestRate` * 12
  ELSE `interestRate`
END;
