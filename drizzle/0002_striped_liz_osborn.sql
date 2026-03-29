CREATE TABLE `file_metadata` (
	`id` text PRIMARY KEY NOT NULL,
	`file_id` text NOT NULL,
	`date_taken` integer,
	`latitude` text,
	`longitude` text,
	`camera` text,
	`width` integer,
	`height` integer,
	`extracted_text` text,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE no action
);
