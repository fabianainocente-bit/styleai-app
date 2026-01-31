import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { capsules, capsuleItems, capsuleCombinations, wardrobeItems } from "../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";

export const capsulesRouter = router({
  // List all capsules for the current user
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    return db.select().from(capsules).where(eq(capsules.userId, ctx.user.id));
  }),

  // Get a single capsule with its items
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const capsule = await db
        .select()
        .from(capsules)
        .where(and(eq(capsules.id, input.id), eq(capsules.userId, ctx.user.id)))
        .limit(1);

      if (capsule.length === 0) {
        throw new Error("Capsule not found");
      }

      // Get items in this capsule
      const items = await db
        .select({
          id: capsuleItems.id,
          wardrobeItemId: capsuleItems.wardrobeItemId,
          addedAt: capsuleItems.addedAt,
          item: wardrobeItems,
        })
        .from(capsuleItems)
        .innerJoin(wardrobeItems, eq(capsuleItems.wardrobeItemId, wardrobeItems.id))
        .where(eq(capsuleItems.capsuleId, input.id));

      return {
        ...capsule[0],
        items,
      };
    }),

  // Create a new capsule
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        occasion: z.string().optional(),
        season: z.string().optional(),
        colorPalette: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const result = await db.insert(capsules).values({
        userId: ctx.user.id,
        name: input.name,
        description: input.description,
        occasion: input.occasion,
        season: input.season,
        colorPalette: input.colorPalette,
      });

      return { id: Number((result as any).insertId) };
    }),

  // Add multiple items to capsule
  addItems: protectedProcedure
    .input(
      z.object({
        capsuleId: z.number(),
        itemIds: z.array(z.number()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify capsule belongs to user
      const capsule = await db
        .select()
        .from(capsules)
        .where(and(eq(capsules.id, input.capsuleId), eq(capsules.userId, ctx.user.id)))
        .limit(1);

      if (capsule.length === 0) {
        throw new Error("Capsule not found");
      }

      // Add all items
      for (const itemId of input.itemIds) {
        await db.insert(capsuleItems).values({
          capsuleId: input.capsuleId,
          wardrobeItemId: itemId,
        });
      }

      // Update totalItems count
      const itemCount = await db
        .select()
        .from(capsuleItems)
        .where(eq(capsuleItems.capsuleId, input.capsuleId));

      await db
        .update(capsules)
        .set({ totalItems: itemCount.length })
        .where(eq(capsules.id, input.capsuleId));

      return { success: true };
    }),

  // Add item to capsule
  addItem: protectedProcedure
    .input(
      z.object({
        capsuleId: z.number(),
        wardrobeItemId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify capsule belongs to user
      const capsule = await db
        .select()
        .from(capsules)
        .where(and(eq(capsules.id, input.capsuleId), eq(capsules.userId, ctx.user.id)))
        .limit(1);

      if (capsule.length === 0) {
        throw new Error("Capsule not found");
      }

      await db.insert(capsuleItems).values({
        capsuleId: input.capsuleId,
        wardrobeItemId: input.wardrobeItemId,
      });

      // Update totalItems count
      const itemCount = await db
        .select()
        .from(capsuleItems)
        .where(eq(capsuleItems.capsuleId, input.capsuleId));

      await db
        .update(capsules)
        .set({ totalItems: itemCount.length })
        .where(eq(capsules.id, input.capsuleId));

      return { success: true };
    }),

  // Remove item from capsule
  removeItem: protectedProcedure
    .input(
      z.object({
        capsuleId: z.number(),
        itemId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify capsule belongs to user
      const capsule = await db
        .select()
        .from(capsules)
        .where(and(eq(capsules.id, input.capsuleId), eq(capsules.userId, ctx.user.id)))
        .limit(1);

      if (capsule.length === 0) {
        throw new Error("Capsule not found");
      }

      await db
        .delete(capsuleItems)
        .where(and(eq(capsuleItems.id, input.itemId), eq(capsuleItems.capsuleId, input.capsuleId)));

      // Update totalItems count
      const itemCount = await db
        .select()
        .from(capsuleItems)
        .where(eq(capsuleItems.capsuleId, input.capsuleId));

      await db
        .update(capsules)
        .set({ totalItems: itemCount.length })
        .where(eq(capsules.id, input.capsuleId));

      return { success: true };
    }),

  // Get combinations for a capsule with item details
  getCombinations: protectedProcedure
    .input(z.object({ capsuleId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      // Verify capsule belongs to user
      const capsule = await db
        .select()
        .from(capsules)
        .where(and(eq(capsules.id, input.capsuleId), eq(capsules.userId, ctx.user.id)))
        .limit(1);

      if (capsule.length === 0) {
        throw new Error("Capsule not found");
      }

      // Use raw SQL to fetch combinations with explicit JSON conversion
      const result = await db.execute(
        sql`SELECT id, capsuleId, name, CAST(itemIds AS CHAR) as itemIds, aiDescription, isFavorite, createdAt FROM capsuleCombinations WHERE capsuleId = ${input.capsuleId}`
      );
      
      // MySQL execute returns array directly, not result.rows
      // The result is a nested array: [[rows], metadata]
      const rawCombinations = Array.isArray(result) && Array.isArray(result[0]) ? result[0] : (Array.isArray(result) ? result : []);
      const combinations = rawCombinations.map((row: any) => ({
        ...row,
        itemIds: typeof row.itemIds === 'string' ? JSON.parse(row.itemIds) : (row.itemIds || []),
      }));

      // Fetch item details for each combination
      try {
        const combinationsWithItems = await Promise.all(
          combinations.map(async (combo) => {
            const items = await db
              .select()
              .from(wardrobeItems)
              .where(eq(wardrobeItems.userId, ctx.user.id));
            
            const comboItems = items.filter(item => combo.itemIds.includes(item.id));
            
            return {
              ...combo,
              items: comboItems,
            };
          })
        );

        return combinationsWithItems;
      } catch (error) {
        console.error('[getCombinations] Error:', error);
        return [];
      }
    }),

  // Generate combinations for a capsule
  generateCombinations: protectedProcedure
    .input(z.object({ capsuleId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify capsule belongs to user
      const capsule = await db
        .select()
        .from(capsules)
        .where(and(eq(capsules.id, input.capsuleId), eq(capsules.userId, ctx.user.id)))
        .limit(1);

      if (capsule.length === 0) {
        throw new Error("Capsule not found");
      }

      // Get items in capsule
      const items = await db
        .select({
          id: wardrobeItems.id,
          category: wardrobeItems.category,
          name: wardrobeItems.name,
        })
        .from(capsuleItems)
        .innerJoin(wardrobeItems, eq(capsuleItems.wardrobeItemId, wardrobeItems.id))
        .where(eq(capsuleItems.capsuleId, input.capsuleId));

      if (items.length < 2) {
        throw new Error("Need at least 2 items to generate combinations");
      }

      // Delete existing combinations
      await db.delete(capsuleCombinations).where(eq(capsuleCombinations.capsuleId, input.capsuleId));

      // Group items by category
      const tops = items.filter((i) => i.category === "top");
      const bottoms = items.filter((i) => i.category === "bottom");
      const dresses = items.filter((i) => i.category === "dress");
      const outerwear = items.filter((i) => i.category === "outerwear");
      const shoes = items.filter((i) => i.category === "shoes");
      const accessories = items.filter((i) => ["accessory", "bag", "jewelry", "hat"].includes(i.category));

      const combinations: Array<{ name: string; itemIds: number[] }> = [];

      // Generate top + bottom combinations
      for (const top of tops) {
        for (const bottom of bottoms) {
          const baseCombo = [top.id, bottom.id];
          
          // Variation 1: Basic outfit (top + bottom)
          if (shoes.length === 0 && outerwear.length === 0 && accessories.length === 0) {
            combinations.push({
              name: `${top.name} + ${bottom.name}`,
              itemIds: baseCombo,
            });
          }
          
          // Variation 2: With shoes
          if (shoes.length > 0) {
            for (const shoe of shoes) {
              const withShoes = [...baseCombo, shoe.id];
              
              // Just with shoes
              if (outerwear.length === 0 && accessories.length === 0) {
                combinations.push({
                  name: `${top.name} + ${bottom.name} + ${shoe.name}`,
                  itemIds: withShoes,
                });
              }
              
              // With shoes and outerwear
              for (const outer of outerwear) {
                const withOuter = [...withShoes, outer.id];
                combinations.push({
                  name: `${top.name} + ${bottom.name} + ${outer.name} + ${shoe.name}`,
                  itemIds: withOuter,
                });
                
                // With shoes, outerwear and accessories (limit to 2 accessories per combo)
                if (accessories.length > 0) {
                  for (let i = 0; i < Math.min(accessories.length, 2); i++) {
                    combinations.push({
                      name: `Look completo ${combinations.length + 1}`,
                      itemIds: [...withOuter, accessories[i].id],
                    });
                  }
                }
              }
              
              // With shoes and accessories (no outerwear)
              if (outerwear.length === 0 && accessories.length > 0) {
                for (const acc of accessories.slice(0, 2)) {
                  combinations.push({
                    name: `${top.name} + ${bottom.name} + ${shoe.name} + ${acc.name}`,
                    itemIds: [...withShoes, acc.id],
                  });
                }
              }
            }
          }
        }
      }

      // Generate dress combinations
      for (const dress of dresses) {
        // Basic dress
        if (shoes.length === 0 && outerwear.length === 0 && accessories.length === 0) {
          combinations.push({
            name: dress.name,
            itemIds: [dress.id],
          });
        }
        
        // Dress with shoes
        for (const shoe of shoes) {
          const dressCombo = [dress.id, shoe.id];
          
          if (outerwear.length === 0 && accessories.length === 0) {
            combinations.push({
              name: `${dress.name} + ${shoe.name}`,
              itemIds: dressCombo,
            });
          }
          
          // Dress with shoes and outerwear
          for (const outer of outerwear) {
            combinations.push({
              name: `${dress.name} + ${outer.name} + ${shoe.name}`,
              itemIds: [...dressCombo, outer.id],
            });
          }
          
          // Dress with shoes and accessories
          for (const acc of accessories.slice(0, 2)) {
            combinations.push({
              name: `${dress.name} + ${shoe.name} + ${acc.name}`,
              itemIds: [...dressCombo, acc.id],
            });
          }
        }
      }

      // Save combinations to database using raw SQL
      for (const combo of combinations) {
        await db.execute(
          sql`INSERT INTO capsuleCombinations (capsuleId, name, itemIds) VALUES (${input.capsuleId}, ${combo.name}, ${JSON.stringify(combo.itemIds)})`
        );
      }

      // Update totalCombinations count
      await db
        .update(capsules)
        .set({ totalCombinations: combinations.length })
        .where(eq(capsules.id, input.capsuleId));

      return { success: true, count: combinations.length };
    }),

  // Generate AI-powered combination suggestions
  generateAISuggestions: protectedProcedure
    .input(z.object({ capsuleId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify capsule belongs to user
      const capsule = await db
        .select()
        .from(capsules)
        .where(and(eq(capsules.id, input.capsuleId), eq(capsules.userId, ctx.user.id)))
        .limit(1);

      if (capsule.length === 0) {
        throw new Error("Capsule not found");
      }

      // Get items in capsule with full details
      const items = await db
        .select({
          id: wardrobeItems.id,
          category: wardrobeItems.category,
          name: wardrobeItems.name,
          color: wardrobeItems.color,
          brand: wardrobeItems.brand,
          season: wardrobeItems.season,
        })
        .from(capsuleItems)
        .innerJoin(wardrobeItems, eq(capsuleItems.wardrobeItemId, wardrobeItems.id))
        .where(eq(capsuleItems.capsuleId, input.capsuleId));

      if (items.length < 2) {
        throw new Error("Need at least 2 items to generate AI suggestions");
      }

      // Prepare item descriptions for AI
      const itemDescriptions = items.map((item, idx) => 
        `${idx + 1}. ${item.name} (ID: ${item.id}, Categoria: ${item.category}, Cor: ${item.color || 'não especificada'}, Marca: ${item.brand || 'não especificada'}, Estação: ${item.season || 'não especificada'})`
      ).join('\n');

      // Call AI to generate intelligent combinations
      const aiResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Você é um estilista profissional especializado em criar combinações de looks. Analise as peças fornecidas e crie combinações inteligentes considerando:
- Harmonia de cores
- Ocasiões apropriadas (casual, formal, festa, trabalho)
- Estações do ano
- Estilo e coerência visual
- Versatilidade e praticidade

Retorne APENAS um JSON válido no formato especificado, sem texto adicional.`
          },
          {
            role: "user",
            content: `Crie até 8 combinações inteligentes usando estas peças:\n\n${itemDescriptions}\n\nPara cada combinação, escolha 2-5 peças que combinem bem. Retorne um JSON com este formato exato:\n{\n  "combinations": [\n    {\n      "name": "Nome descritivo do look",\n      "itemIds": [1, 2, 3],\n      "occasion": "casual|formal|festa|trabalho",\n      "season": "verão|inverno|primavera|outono|todas",\n      "description": "Breve explicação do por quê essa combinação funciona"\n    }\n  ]\n}`
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "outfit_combinations",
            strict: true,
            schema: {
              type: "object",
              properties: {
                combinations: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string", description: "Nome descritivo do look" },
                      itemIds: { 
                        type: "array", 
                        items: { type: "number" },
                        description: "IDs das peças que compõem a combinação"
                      },
                      occasion: { 
                        type: "string",
                        enum: ["casual", "formal", "festa", "trabalho"],
                        description: "Ocasião apropriada para o look"
                      },
                      season: { 
                        type: "string",
                        enum: ["verão", "inverno", "primavera", "outono", "todas"],
                        description: "Estação do ano apropriada"
                      },
                      description: { type: "string", description: "Explicação do por quê a combinação funciona" }
                    },
                    required: ["name", "itemIds", "occasion", "season", "description"],
                    additionalProperties: false
                  }
                }
              },
              required: ["combinations"],
              additionalProperties: false
            }
          }
        }
      });

      const aiContent = aiResponse.choices[0]?.message?.content;
      if (!aiContent || typeof aiContent !== 'string') {
        throw new Error("AI did not return a valid response");
      }

      const suggestions = JSON.parse(aiContent);

      // Delete existing combinations
      await db.delete(capsuleCombinations).where(eq(capsuleCombinations.capsuleId, input.capsuleId));

      // Save AI-generated combinations to database
      for (const combo of suggestions.combinations) {
        // Validate that all itemIds exist in the capsule
        const validItemIds = combo.itemIds.filter((id: number) => items.some(item => item.id === id));
        
        if (validItemIds.length >= 2) {
          await db.execute(
            sql`INSERT INTO capsuleCombinations (capsuleId, name, itemIds, aiDescription) VALUES (${input.capsuleId}, ${combo.name}, ${JSON.stringify(validItemIds)}, ${`${combo.occasion} • ${combo.season} • ${combo.description}`})`
          );
        }
      }

      // Update totalCombinations count
      const validCombinations = suggestions.combinations.filter((c: any) => 
        c.itemIds.filter((id: number) => items.some(item => item.id === id)).length >= 2
      );
      
      await db
        .update(capsules)
        .set({ totalCombinations: validCombinations.length })
        .where(eq(capsules.id, input.capsuleId));

      return { 
        success: true, 
        count: validCombinations.length,
        suggestions: validCombinations
      };
    }),

  // Delete a capsule
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify capsule belongs to user
      const capsule = await db
        .select()
        .from(capsules)
        .where(and(eq(capsules.id, input.id), eq(capsules.userId, ctx.user.id)))
        .limit(1);

      if (capsule.length === 0) {
        throw new Error("Capsule not found");
      }

      // Delete related items and combinations
      await db.delete(capsuleItems).where(eq(capsuleItems.capsuleId, input.id));
      await db.delete(capsuleCombinations).where(eq(capsuleCombinations.capsuleId, input.id));
      await db.delete(capsules).where(eq(capsules.id, input.id));

      return { success: true };
    }),
});
