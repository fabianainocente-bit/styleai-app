import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { Context } from "./_core/context";

// Mock context for authenticated user
const mockContext: Context = {
  user: {
    id: 1,
    openId: "test-open-id",
    name: "Test User",
    email: "test@example.com",
    loginMethod: "google",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    avatarUrl: null,
    mirrorPhotoUrl: null,
    stylePreferences: null,
    bodyMeasurements: null,
  },
  req: {} as any,
  res: {} as any,
};

describe("Capsules Router", () => {
  it("should list capsules for the user", async () => {
    const caller = appRouter.createCaller(mockContext);
    
    const capsules = await caller.capsules.list();

    expect(Array.isArray(capsules)).toBe(true);
  });

  it("should have capsules router registered", () => {
    expect(appRouter._def.procedures).toHaveProperty("capsules.list");
    expect(appRouter._def.procedures).toHaveProperty("capsules.create");
    expect(appRouter._def.procedures).toHaveProperty("capsules.get");
    expect(appRouter._def.procedures).toHaveProperty("capsules.delete");
    expect(appRouter._def.procedures).toHaveProperty("capsules.getCombinations");
    expect(appRouter._def.procedures).toHaveProperty("capsules.generateCombinations");
  });
});
