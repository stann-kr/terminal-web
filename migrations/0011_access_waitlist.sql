CREATE TABLE `access_waitlist` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`artist_id` text NOT NULL,
	`invited_by` text,
	`name` text NOT NULL,
	`instagram` text NOT NULL,
	`privacy_consent` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`artist_id`) REFERENCES `artists`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `access_waitlist_event_artist_idx` ON `access_waitlist` (`event_id`,`artist_id`);