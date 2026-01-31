import { eq, and, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, wardrobeItems, InsertWardrobeItem, WardrobeItem } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Wardrobe Items Queries
export async function createWardrobeItem(item: InsertWardrobeItem): Promise<WardrobeItem | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create wardrobe item: database not available");
    return null;
  }

  try {
    const result = await db.insert(wardrobeItems).values(item);
    const insertId = Number(result[0].insertId);
    
    // Fetch the created item
    const created = await db.select().from(wardrobeItems).where(eq(wardrobeItems.id, insertId)).limit(1);
    return created.length > 0 ? created[0] : null;
  } catch (error) {
    console.error("[Database] Failed to create wardrobe item:", error);
    throw error;
  }
}

export async function getWardrobeItemsByUserId(userId: number): Promise<WardrobeItem[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get wardrobe items: database not available");
    return [];
  }

  return await db.select().from(wardrobeItems)
    .where(eq(wardrobeItems.userId, userId))
    .orderBy(desc(wardrobeItems.createdAt));
}

export async function getWardrobeItemById(id: number, userId: number): Promise<WardrobeItem | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get wardrobe item: database not available");
    return null;
  }

  const result = await db.select().from(wardrobeItems)
    .where(and(eq(wardrobeItems.id, id), eq(wardrobeItems.userId, userId)))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

export async function updateWardrobeItem(id: number, userId: number, updates: Partial<InsertWardrobeItem>): Promise<WardrobeItem | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update wardrobe item: database not available");
    return null;
  }

  try {
    await db.update(wardrobeItems)
      .set(updates)
      .where(and(eq(wardrobeItems.id, id), eq(wardrobeItems.userId, userId)));
    
    return await getWardrobeItemById(id, userId);
  } catch (error) {
    console.error("[Database] Failed to update wardrobe item:", error);
    throw error;
  }
}

export async function deleteWardrobeItem(id: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot delete wardrobe item: database not available");
    return false;
  }

  try {
    await db.delete(wardrobeItems)
      .where(and(eq(wardrobeItems.id, id), eq(wardrobeItems.userId, userId)));
    return true;
  } catch (error) {
    console.error("[Database] Failed to delete wardrobe item:", error);
    throw error;
  }
}
