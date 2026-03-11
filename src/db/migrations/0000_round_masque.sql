CREATE TABLE `courses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`par` integer,
	`slope_rating` real,
	`course_rating` real
);
--> statement-breakpoint
CREATE TABLE `fixtures` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`opponent_club_id` integer NOT NULL,
	`course_id` integer NOT NULL,
	`home_away` text DEFAULT 'home' NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`opponent_club_id`) REFERENCES `opponent_clubs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `matches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`fixture_id` integer NOT NULL,
	`player1_id` integer NOT NULL,
	`player2_id` integer NOT NULL,
	`player1_handicap` real NOT NULL,
	`player2_handicap` real NOT NULL,
	`opponent1_name` text NOT NULL,
	`opponent2_name` text NOT NULL,
	`opponent1_handicap` real NOT NULL,
	`opponent2_handicap` real NOT NULL,
	`result` text NOT NULL,
	`margin` text,
	`match_order` integer,
	`notes` text,
	FOREIGN KEY (`fixture_id`) REFERENCES `fixtures`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player1_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player2_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `opponent_clubs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`phone` text,
	`default_handicap` real DEFAULT 18 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL
);
