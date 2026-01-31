import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, decimal, date, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  // StyleAI specific fields
  avatarUrl: text("avatarUrl"),
  mirrorPhotoUrl: text("mirrorPhotoUrl"),
  stylePreferences: json("stylePreferences").$type<{
    colors?: string[];
    styles?: string[];
    favoriteBrands?: string[];
  }>(),
  bodyMeasurements: json("bodyMeasurements").$type<{
    height?: string;
    size?: string;
    shoeSize?: string;
  }>(),
  onboardingCompleted: boolean("onboardingCompleted").default(false).notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Clothing categories enum
export const clothingCategoryEnum = mysqlEnum("clothingCategory", [
  "top", "bottom", "dress", "outerwear", "shoes", 
  "accessory", "bag", "jewelry", "hat", "other"
]);

// Clothing season enum
export const clothingSeasonEnum = mysqlEnum("clothingSeason", [
  "spring", "summer", "fall", "winter", "all_season"
]);

// Clothing occasion enum
export const clothingOccasionEnum = mysqlEnum("clothingOccasion", [
  "casual", "work", "formal", "sport", "party", "travel"
]);

/**
 * Wardrobe items table - stores all clothing items
 */
export const wardrobeItems = mysqlTable("wardrobeItems", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  category: clothingCategoryEnum.notNull(),
  color: varchar("color", { length: 100 }).notNull(),
  brand: varchar("brand", { length: 255 }),
  season: clothingSeasonEnum.default("all_season"),
  occasions: json("occasions").$type<string[]>(),
  imageUrl: text("imageUrl"),
  purchaseDate: date("purchaseDate"),
  price: decimal("price", { precision: 10, scale: 2 }),
  timesWorn: int("timesWorn").default(0),
  lastWornDate: date("lastWornDate"),
  tags: json("tags").$type<string[]>(),
  notes: text("notes"),
  isFavorite: boolean("isFavorite").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WardrobeItem = typeof wardrobeItems.$inferSelect;
export type InsertWardrobeItem = typeof wardrobeItems.$inferInsert;

/**
 * Mirror analyses table - stores AI feedback on looks
 */
export const mirrorAnalyses = mysqlTable("mirrorAnalyses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  photoUrl: text("photoUrl").notNull(),
  aiFeedback: json("aiFeedback").$type<{
    overallScore: number;
    suggestions: string[];
    positivePoints: string[];
    colorHarmony: string;
    styleAnalysis: string;
    contextualFit: string;
    trendScore: number;
  }>().notNull(),
  userRating: int("userRating"),
  userNotes: text("userNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MirrorAnalysis = typeof mirrorAnalyses.$inferSelect;
export type InsertMirrorAnalysis = typeof mirrorAnalyses.$inferInsert;

/**
 * Trips table - stores planned trips
 */
export const trips = mysqlTable("trips", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  destination: varchar("destination", { length: 255 }).notNull(),
  startDate: date("startDate").notNull(),
  endDate: date("endDate").notNull(),
  tripType: varchar("tripType", { length: 50 }), // business, leisure, mixed
  weatherInfo: json("weatherInfo").$type<{
    avgTemp?: number;
    conditions?: string;
  }>(),
  occasionsNeeded: json("occasionsNeeded").$type<string[]>(),
  status: mysqlEnum("status", ["planning", "packed", "ongoing", "completed"]).default("planning"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Trip = typeof trips.$inferSelect;
export type InsertTrip = typeof trips.$inferInsert;

/**
 * Trip items table - stores items selected for a trip
 */
export const tripItems = mysqlTable("tripItems", {
  id: int("id").autoincrement().primaryKey(),
  tripId: int("tripId").notNull(),
  wardrobeItemId: int("wardrobeItemId").notNull(),
  aiReason: text("aiReason"),
  isPacked: boolean("isPacked").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TripItem = typeof tripItems.$inferSelect;
export type InsertTripItem = typeof tripItems.$inferInsert;

/**
 * Outfits table - stores created looks/combinations
 */
export const outfits = mysqlTable("outfits", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  itemIds: json("itemIds").$type<number[]>().notNull(),
  occasion: varchar("occasion", { length: 50 }),
  season: varchar("season", { length: 50 }),
  status: mysqlEnum("outfitStatus", ["draft", "saved", "worn", "favorite"]).default("saved"),
  aiGenerated: boolean("aiGenerated").default(false),
  aiDescription: text("aiDescription"),
  previewImageUrl: text("previewImageUrl"),
  timesWorn: int("timesWorn").default(0),
  userRating: int("userRating"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Outfit = typeof outfits.$inferSelect;
export type InsertOutfit = typeof outfits.$inferInsert;

/**
 * Achievements table - stores available achievements/badges
 */
export const achievements = mysqlTable("achievements", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 100 }),
  category: varchar("category", { length: 100 }), // sustainability, creativity, consistency
  points: int("points").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Achievement = typeof achievements.$inferSelect;
export type InsertAchievement = typeof achievements.$inferInsert;

/**
 * User achievements table - stores user's unlocked achievements
 */
export const userAchievements = mysqlTable("userAchievements", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  achievementId: int("achievementId").notNull(),
  unlockedAt: timestamp("unlockedAt").defaultNow().notNull(),
});

export type UserAchievement = typeof userAchievements.$inferSelect;
export type InsertUserAchievement = typeof userAchievements.$inferInsert;

/**
 * Calendar events table - stores user's events
 */
export const calendarEvents = mysqlTable("calendarEvents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  eventType: varchar("eventType", { length: 100 }),
  startTime: timestamp("startTime").notNull(),
  endTime: timestamp("endTime"),
  location: varchar("location", { length: 255 }),
  dressCode: varchar("dressCode", { length: 100 }),
  weatherForecast: json("weatherForecast").$type<{
    temp?: number;
    condition?: string;
  }>(),
  outfitId: int("outfitId"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertCalendarEvent = typeof calendarEvents.$inferInsert;

/**
 * Style analysis table - stores user's style profile
 */
export const styleAnalysis = mysqlTable("styleAnalysis", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  dominantColors: json("dominantColors").$type<string[]>(),
  favoriteCategories: json("favoriteCategories").$type<string[]>(),
  styleProfile: json("styleProfile").$type<{
    primaryStyle?: string;
    secondaryStyle?: string;
    personality?: string;
  }>(),
  wardrobeGaps: json("wardrobeGaps").$type<{
    missingBasics?: string[];
    suggestedPurchases?: string[];
  }>(),
  sustainabilityScore: int("sustainabilityScore"),
  lastAnalyzedAt: timestamp("lastAnalyzedAt").defaultNow(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StyleAnalysis = typeof styleAnalysis.$inferSelect;
export type InsertStyleAnalysis = typeof styleAnalysis.$inferInsert;

/**
 * Challenges table - stores available challenges
 */
export const challenges = mysqlTable("challenges", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }), // sustainability, creativity, consistency
  points: int("points").default(0),
  duration: varchar("duration", { length: 50 }), // daily, weekly, monthly
  requirements: json("requirements").$type<{
    type: string;
    target: number;
  }>(),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Challenge = typeof challenges.$inferSelect;
export type InsertChallenge = typeof challenges.$inferInsert;

/**
 * User challenges table - stores user's challenge progress
 */
export const userChallenges = mysqlTable("userChallenges", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  challengeId: int("challengeId").notNull(),
  progress: int("progress").default(0),
  challengeStatus: mysqlEnum("challengeStatus", ["active", "completed", "failed"]).default("active"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type UserChallenge = typeof userChallenges.$inferSelect;
export type InsertUserChallenge = typeof userChallenges.$inferInsert;

/**
 * Capsules table - stores wardrobe capsules
 */
export const capsules = mysqlTable("capsules", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  occasion: varchar("occasion", { length: 100 }), // work, casual, formal, travel, sport
  season: varchar("season", { length: 50 }), // spring, summer, fall, winter, all_season
  colorPalette: json("colorPalette").$type<string[]>(),
  totalItems: int("totalItems").default(0),
  totalCombinations: int("totalCombinations").default(0),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Capsule = typeof capsules.$inferSelect;
export type InsertCapsule = typeof capsules.$inferInsert;

/**
 * Capsule items table - stores items in a capsule
 */
export const capsuleItems = mysqlTable("capsuleItems", {
  id: int("id").autoincrement().primaryKey(),
  capsuleId: int("capsuleId").notNull(),
  wardrobeItemId: int("wardrobeItemId").notNull(),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
});

export type CapsuleItem = typeof capsuleItems.$inferSelect;
export type InsertCapsuleItem = typeof capsuleItems.$inferInsert;

/**
 * Capsule combinations table - stores generated outfit combinations from a capsule
 */
export const capsuleCombinations = mysqlTable("capsuleCombinations", {
  id: int("id").autoincrement().primaryKey(),
  capsuleId: int("capsuleId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  itemIds: json("itemIds").$type<number[]>().notNull(),
  aiDescription: text("aiDescription"),
  isFavorite: boolean("isFavorite").default(false),
  timesWorn: int("timesWorn").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CapsuleCombination = typeof capsuleCombinations.$inferSelect;
export type InsertCapsuleCombination = typeof capsuleCombinations.$inferInsert;
