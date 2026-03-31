CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`icon` text DEFAULT 'info',
	`action_url` text,
	`read` integer DEFAULT false,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE INDEX `notifications_user_idx` ON `notifications` (`user_id`, `created_at`);