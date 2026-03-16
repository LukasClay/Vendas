ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','consultora') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `sales` ADD `completedAt` timestamp;