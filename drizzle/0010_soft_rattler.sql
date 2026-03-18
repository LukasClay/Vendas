ALTER TABLE `products` ADD `deletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `sales` ADD `sellerName` varchar(256);--> statement-breakpoint
ALTER TABLE `users` ADD `deletedAt` timestamp;