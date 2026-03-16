ALTER TABLE `sales` ADD `workStatus` enum('para_escrever','pendente','feito') DEFAULT 'para_escrever' NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `writtenAt` timestamp;