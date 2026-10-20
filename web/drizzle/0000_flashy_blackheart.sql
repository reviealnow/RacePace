CREATE TABLE `workouts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`started` integer NOT NULL,
	`duration` real NOT NULL,
	`distance` real NOT NULL,
	`payload` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `workouts_owner_started` ON `workouts` (`owner`,`started`);