ALTER TABLE `consultation_slots` ADD `status` enum('pendente','realizada','cancelada') DEFAULT 'pendente' NOT NULL;--> statement-breakpoint
ALTER TABLE `consultation_slots` ADD `cancelledBy` int;--> statement-breakpoint
ALTER TABLE `consultation_slots` ADD `cancelledAt` timestamp;