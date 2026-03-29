ALTER TABLE `files` ADD `encrypted` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `files` ADD `iv` text;--> statement-breakpoint
ALTER TABLE `users` ADD `encryption_salt` text;--> statement-breakpoint
ALTER TABLE `users` ADD `encrypted_master_key` text;--> statement-breakpoint
ALTER TABLE `users` ADD `master_key_iv` text;--> statement-breakpoint
ALTER TABLE `users` ADD `totp_secret` text;--> statement-breakpoint
ALTER TABLE `users` ADD `totp_enabled` integer DEFAULT false;