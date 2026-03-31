ALTER TABLE `files` ADD `scan_status` text DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `files` ADD `scan_result` text;