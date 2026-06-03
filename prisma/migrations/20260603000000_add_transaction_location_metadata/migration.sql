ALTER TABLE `Transaction`
    ADD COLUMN `location` TEXT NULL AFTER `descriptionEncrypted`,
    ADD COLUMN `latitude` DOUBLE NULL AFTER `location`,
    ADD COLUMN `longitude` DOUBLE NULL AFTER `latitude`,
    ADD COLUMN `googleMapsLink` TEXT NULL AFTER `longitude`;
