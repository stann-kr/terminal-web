CREATE TABLE `mail_stats` (
	`mail_key` text NOT NULL,
	`day` text NOT NULL,
	`kind` text NOT NULL,
	`target` text DEFAULT '' NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`mail_key`, `day`, `kind`, `target`)
);
