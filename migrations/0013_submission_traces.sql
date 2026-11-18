CREATE TABLE `submission_traces` (
	`kind` text NOT NULL,
	`record_id` text NOT NULL,
	`created_at` text NOT NULL,
	`country` text,
	`region` text,
	`city` text,
	`asn` integer,
	`as_org` text,
	`ip_hash` text,
	`browser` text,
	`os` text,
	`device` text,
	`entry_kind` text,
	`entry_artist_id` text,
	`entry_event_id` text,
	`entry_referrer` text,
	`entry_at` text,
	PRIMARY KEY(`kind`, `record_id`)
);
--> statement-breakpoint
CREATE INDEX `submission_traces_created_at_idx` ON `submission_traces` (`created_at`);--> statement-breakpoint
CREATE INDEX `submission_traces_ip_hash_idx` ON `submission_traces` (`ip_hash`);