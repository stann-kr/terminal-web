PRAGMA defer_foreign_keys = on;--> statement-breakpoint
CREATE TABLE `__new_signal` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text,
	`instagram` text NOT NULL,
	`source` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_signal`("id", "name", "email", "instagram", "source", "created_at") SELECT "id", "name", "email", "instagram", "source", "created_at" FROM `signal`;--> statement-breakpoint
DROP TABLE `signal`;--> statement-breakpoint
ALTER TABLE `__new_signal` RENAME TO `signal`;--> statement-breakpoint
CREATE UNIQUE INDEX `signal_email_idx` ON `signal` (`email`);
