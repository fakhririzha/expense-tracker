CREATE INDEX `RecurringRule_userId_isActive_nextDueDate_idx`
    ON `RecurringRule`(`userId`, `isActive`, `nextDueDate`);

CREATE INDEX `WeeklyAiInsight_status_periodStart_idx`
    ON `WeeklyAiInsight`(`status`, `periodStart`);
