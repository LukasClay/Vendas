CREATE TABLE `consultation_slots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`consultationDate` date NOT NULL,
	`consultationTime` varchar(5) NOT NULL,
	`sold` boolean NOT NULL DEFAULT false,
	`saleId` int,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `consultation_slots_id` PRIMARY KEY(`id`)
);
