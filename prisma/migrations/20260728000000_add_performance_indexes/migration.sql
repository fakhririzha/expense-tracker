CREATE INDEX `RecurringRule_isActive_nextDueDate_idx`
    ON `RecurringRule`(`isActive`, `nextDueDate`);

CREATE INDEX `WeeklyAiInsight_status_periodStart_idx`
    ON `WeeklyAiInsight`(`status`, `periodStart`);
