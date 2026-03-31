CREATE TABLE `file_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`file_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`size` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE no action
);