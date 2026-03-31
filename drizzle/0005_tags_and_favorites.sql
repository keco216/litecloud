CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL DEFAULT '#9ca3af',
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint

CREATE TABLE `file_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`file_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint

CREATE UNIQUE INDEX `file_tags_unique` ON `file_tags` (`file_id`, `tag_id`);--> statement-breakpoint

ALTER TABLE `files` ADD `starred` integer DEFAULT false;