PRAGMA defer_foreign_keys = on;--> statement-breakpoint
CREATE TABLE `__new_access_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`instagram` text NOT NULL,
	`artist_id` text,
	`invited_by` text,
	`privacy_consent` integer NOT NULL,
	`marketing_consent` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`artist_id`) REFERENCES `artists`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_access_requests`("id", "event_id", "name", "email", "instagram", "artist_id", "invited_by", "privacy_consent", "marketing_consent", "created_at") SELECT "id", "event_id", "name", "email", "instagram", "artist_id", "invited_by", "privacy_consent", "marketing_consent", "created_at" FROM `access_requests`;--> statement-breakpoint
DROP TABLE `access_requests`;--> statement-breakpoint
ALTER TABLE `__new_access_requests` RENAME TO `access_requests`;--> statement-breakpoint
CREATE UNIQUE INDEX `access_requests_event_email_idx` ON `access_requests` (`event_id`,`email`);
