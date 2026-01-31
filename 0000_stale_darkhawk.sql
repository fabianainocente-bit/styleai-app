CREATE TABLE `capsuleCombinations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`capsuleId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`itemIds` json NOT NULL,
	`aiDescription` text,
	`isFavorite` boolean DEFAULT false,
	`timesWorn` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `capsuleCombinations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `capsuleItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`capsuleId` int NOT NULL,
	`wardrobeItemId` int NOT NULL,
	`addedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `capsuleItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `capsules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`occasion` varchar(100),
	`season` varchar(50),
	`colorPalette` json,
	`totalItems` int DEFAULT 0,
	`totalCombinations` int DEFAULT 0,
	`isActive` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `capsules_id` PRIMARY KEY(`id`)
);
