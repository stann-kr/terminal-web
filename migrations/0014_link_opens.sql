CREATE TABLE `link_opens` (
	`day` text NOT NULL,
	`event_id` text NOT NULL,
	`artist_id` text NOT NULL,
	`source` text DEFAULT '' NOT NULL,
	`opens` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`day`, `event_id`, `artist_id`, `source`)
);
--> statement-breakpoint
ALTER TABLE `submission_traces` ADD `entry_source` text;