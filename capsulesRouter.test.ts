import { describe, it, expect, vi, beforeEach } from "vitest";
import { capsulesRouter } from "./capsulesRouter";
import { getDb } from "./db";
import { invokeLLM } from "./_core/llm";

// Mock dependencies
vi.mock("./db");
vi.mock("./_core/llm");

describe("capsulesRouter - AI Suggestions", () => {
  const mockCtx = {
    user: {
      id: 1,
      openId: "test-user",
      name: "Test User",
      email: "test@example.com",
      role: "user" as const,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should generate AI-powered combination suggestions", async () => {
    let selectCallCount = 0;
    const mockDb = {
      select: vi.fn(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // First call: capsule lookup
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([
              {
                id: 1,
                userId: 1,
                name: "Test Capsule",
                totalItems: 3,
                totalCombinations: 0,
              },
            ]),
          };
        } else {
          // Second call: items lookup
          return {
            from: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([
                  { id: 1, category: "top", name: "Blusa Branca", color: "branco", brand: "Zara", season: "verão" },
                  { id: 2, category: "bottom", name: "Calça Jeans", color: "azul", brand: "Levi's", season: "todas" },
                  { id: 3, category: "shoes", name: "Tênis Branco", color: "branco", brand: "Nike", season: "todas" },
                ]),
              }),
            }),
          };
        }
      }),
      delete: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(true),
      execute: vi.fn().mockResolvedValue(true),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    };

    vi.mocked(getDb).mockResolvedValue(mockDb as any);

    // Mock AI response
    const mockAIResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              combinations: [
                {
                  name: "Look Casual Chic",
                  itemIds: [1, 2, 3],
                  occasion: "casual",
                  season: "verão",
                  description: "Combinação perfeita para um dia casual com estilo",
                },
                {
                  name: "Básico Versátil",
                  itemIds: [1, 2],
                  occasion: "trabalho",
                  season: "todas",
                  description: "Look simples e elegante para o dia a dia",
                },
              ],
            }),
          },
        },
      ],
    };

    vi.mocked(invokeLLM).mockResolvedValue(mockAIResponse as any);

    const caller = capsulesRouter.createCaller(mockCtx as any);
    const result = await caller.generateAISuggestions({ capsuleId: 1 });

    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
    expect(invokeLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "system",
            content: expect.stringContaining("estilista profissional"),
          }),
        ]),
      })
    );
  });

  it("should fail if capsule has less than 2 items", async () => {
    let selectCallCount = 0;
    const mockDb = {
      select: vi.fn(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // First call: capsule lookup
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([
              {
                id: 1,
                userId: 1,
                name: "Test Capsule",
              },
            ]),
          };
        } else {
          // Second call: items lookup - only 1 item
          return {
            from: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([
                  { id: 1, category: "top", name: "Blusa", color: "branco", brand: "Zara", season: "verão" },
                ]),
              }),
            }),
          };
        }
      }),
    };

    vi.mocked(getDb).mockResolvedValue(mockDb as any);

    const caller = capsulesRouter.createCaller(mockCtx as any);

    await expect(caller.generateAISuggestions({ capsuleId: 1 })).rejects.toThrow(
      "Need at least 2 items to generate AI suggestions"
    );
  });

  it("should validate itemIds from AI response", async () => {
    let selectCallCount = 0;
    const mockDb = {
      select: vi.fn(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // First call: capsule lookup
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([
              {
                id: 1,
                userId: 1,
                name: "Test Capsule",
              },
            ]),
          };
        } else {
          // Second call: items lookup
          return {
            from: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([
                  { id: 1, category: "top", name: "Blusa", color: "branco", brand: "Zara", season: "verão" },
                  { id: 2, category: "bottom", name: "Calça", color: "azul", brand: "Levi's", season: "todas" },
                ]),
              }),
            }),
          };
        }
      }),
      delete: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(true),
      execute: vi.fn().mockResolvedValue(true),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    };

    vi.mocked(getDb).mockResolvedValue(mockDb as any);

    // AI returns invalid itemIds (999 doesn't exist)
    const mockAIResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              combinations: [
                {
                  name: "Invalid Combo",
                  itemIds: [1, 999],
                  occasion: "casual",
                  season: "verão",
                  description: "Test",
                },
              ],
            }),
          },
        },
      ],
    };

    vi.mocked(invokeLLM).mockResolvedValue(mockAIResponse as any);

    const caller = capsulesRouter.createCaller(mockCtx as any);
    const result = await caller.generateAISuggestions({ capsuleId: 1 });

    // Should filter out invalid itemIds, resulting in only 1 valid item (less than minimum of 2)
    expect(result.count).toBe(0);
  });
});
