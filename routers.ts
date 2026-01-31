import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { 
  wardrobeItems, 
  mirrorAnalyses, 
  trips, 
  tripItems, 
  outfits,
  challenges,
  userChallenges,
  styleAnalysis,
  users
} from "../drizzle/schema";
import { getDb } from "./db";
import { eq, desc, and, inArray } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { capsulesRouter } from "./capsulesRouter";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Profile router
  profile: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return null;
      
      const result = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
      return result[0] || null;
    }),
    
    update: protectedProcedure
      .input(z.object({
        name: z.string().optional(),
        avatarUrl: z.string().optional(),
        mirrorPhotoUrl: z.string().optional(),
        stylePreferences: z.object({
          colors: z.array(z.string()).optional(),
          styles: z.array(z.string()).optional(),
          favoriteBrands: z.array(z.string()).optional(),
        }).optional(),
        bodyMeasurements: z.object({
          height: z.string().optional(),
          size: z.string().optional(),
          shoeSize: z.string().optional(),
        }).optional(),
        onboardingCompleted: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        await db.update(users)
          .set(input)
          .where(eq(users.id, ctx.user.id));
        
        return { success: true };
      }),
  }),

  // Wardrobe router
  wardrobe: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      
      return db.select()
        .from(wardrobeItems)
        .where(eq(wardrobeItems.userId, ctx.user.id))
        .orderBy(desc(wardrobeItems.createdAt));
    }),
    
    add: protectedProcedure
      .input(z.object({
        name: z.string(),
        category: z.enum(["top", "bottom", "dress", "outerwear", "shoes", "accessory", "bag", "jewelry", "hat", "other"]),
        color: z.string(),
        brand: z.string().optional(),
        season: z.enum(["spring", "summer", "fall", "winter", "all_season"]).optional(),
        occasions: z.array(z.string()).optional(),
        imageUrl: z.string().optional(),
        price: z.string().optional(),
        tags: z.array(z.string()).optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        // Upload image to S3 if it's a base64 string
        let finalImageUrl = input.imageUrl;
        if (input.imageUrl && input.imageUrl.startsWith('data:image')) {
          try {
            // Extract base64 data and mime type
            const matches = input.imageUrl.match(/^data:image\/(\w+);base64,(.+)$/);
            if (matches) {
              const extension = matches[1];
              const base64Data = matches[2];
              const buffer = Buffer.from(base64Data, 'base64');
              const timestamp = Date.now();
              const randomSuffix = Math.random().toString(36).substring(2, 8);
              const fileKey = `wardrobe/${ctx.user.id}/${timestamp}-${randomSuffix}.${extension}`;
              const { url } = await storagePut(fileKey, buffer, `image/${extension}`);
              finalImageUrl = url;
            }
          } catch (error) {
            console.error('Error uploading wardrobe image to S3:', error);
            // Continue without image if upload fails
            finalImageUrl = undefined;
          }
        }
        
        const result = await db.insert(wardrobeItems).values({
          userId: ctx.user.id,
          name: input.name,
          category: input.category,
          color: input.color,
          brand: input.brand,
          season: input.season,
          occasions: input.occasions,
          imageUrl: finalImageUrl,
          tags: input.tags,
          notes: input.notes,
        });
        
        return { success: true, id: result[0].insertId };
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        category: z.enum(["top", "bottom", "dress", "outerwear", "shoes", "accessory", "bag", "jewelry", "hat", "other"]).optional(),
        color: z.string().optional(),
        brand: z.string().optional(),
        season: z.enum(["spring", "summer", "fall", "winter", "all_season"]).optional(),
        occasions: z.array(z.string()).optional(),
        imageUrl: z.string().optional(),
        isFavorite: z.boolean().optional(),
        tags: z.array(z.string()).optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const { id, ...updateData } = input;
        await db.update(wardrobeItems)
          .set(updateData)
          .where(and(eq(wardrobeItems.id, id), eq(wardrobeItems.userId, ctx.user.id)));
        
        return { success: true };
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        await db.delete(wardrobeItems)
          .where(and(eq(wardrobeItems.id, input.id), eq(wardrobeItems.userId, ctx.user.id)));
        
        return { success: true };
      }),
  }),

  // Mirror (AI Analysis) router
  mirror: router({
    analyze: protectedProcedure
      .input(z.object({
        photoUrl: z.string(),
        context: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        // Upload image to S3 if it's a base64 data URL
        let photoUrl = input.photoUrl;
        if (input.photoUrl.startsWith('data:')) {
          const { storagePut } = await import('./storage');
          const matches = input.photoUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (matches) {
            const contentType = matches[1];
            const base64Data = matches[2];
            const buffer = Buffer.from(base64Data, 'base64');
            const ext = contentType.split('/')[1] || 'jpg';
            const fileName = `mirror/${ctx.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
            const result = await storagePut(fileName, buffer, contentType);
            photoUrl = result.url;
          }
        }
        
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `Você é um consultor de moda especializado em análise de looks. Analise a foto do look e forneça feedback detalhado em português brasileiro. Seja construtivo, positivo e específico.`
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Analise este look${input.context ? ` para ${input.context}` : ''}. Forneça:
1. Pontuação geral (0-100)
2. Pontos positivos do look
3. Sugestões de melhoria
4. Análise de harmonia de cores
5. Análise de estilo
6. Adequação ao contexto
7. Pontuação de tendência (0-100)

Responda em JSON com o formato:
{
  "overallScore": number,
  "positivePoints": string[],
  "suggestions": string[],
  "colorHarmony": string,
  "styleAnalysis": string,
  "contextualFit": string,
  "trendScore": number
}`
                },
                {
                  type: "image_url",
                  image_url: { url: input.photoUrl }
                }
              ]
            }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "outfit_analysis",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  overallScore: { type: "number" },
                  positivePoints: { type: "array", items: { type: "string" } },
                  suggestions: { type: "array", items: { type: "string" } },
                  colorHarmony: { type: "string" },
                  styleAnalysis: { type: "string" },
                  contextualFit: { type: "string" },
                  trendScore: { type: "number" }
                },
                required: ["overallScore", "positivePoints", "suggestions", "colorHarmony", "styleAnalysis", "contextualFit", "trendScore"],
                additionalProperties: false
              }
            }
          }
        });
        
        const content = response.choices[0].message.content;
        const aiFeedback = JSON.parse(typeof content === 'string' ? content : JSON.stringify(content) || "{}");
        
        const result = await db.insert(mirrorAnalyses).values({
          userId: ctx.user.id,
          photoUrl: photoUrl,
          aiFeedback,
        });
        
        return { 
          success: true, 
          id: result[0].insertId,
          analysis: aiFeedback 
        };
      }),
    
    history: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      
      return db.select()
        .from(mirrorAnalyses)
        .where(eq(mirrorAnalyses.userId, ctx.user.id))
        .orderBy(desc(mirrorAnalyses.createdAt))
        .limit(20);
    }),
  }),

  // Trips router
  trips: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      
      return db.select()
        .from(trips)
        .where(eq(trips.userId, ctx.user.id))
        .orderBy(desc(trips.startDate));
    }),
    
    create: protectedProcedure
      .input(z.object({
        destination: z.string(),
        startDate: z.string(),
        endDate: z.string(),
        tripType: z.string().optional(),
        occasionsNeeded: z.array(z.string()).optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const result = await db.insert(trips).values({
          userId: ctx.user.id,
          destination: input.destination,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          tripType: input.tripType,
          occasionsNeeded: input.occasionsNeeded,
          notes: input.notes,
        });
        
        return { success: true, id: result[0].insertId };
      }),
    
    suggestItems: protectedProcedure
      .input(z.object({ tripId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const tripResult = await db.select().from(trips).where(eq(trips.id, input.tripId)).limit(1);
        const trip = tripResult[0];
        if (!trip) throw new Error("Trip not found");
        
        const wardrobe = await db.select()
          .from(wardrobeItems)
          .where(eq(wardrobeItems.userId, ctx.user.id));
        
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `Você é um consultor de moda especializado em planejamento de malas. Sugira as peças ideais do guarda-roupa do usuário para a viagem.`
            },
            {
              role: "user",
              content: `Viagem para ${trip.destination} de ${trip.startDate} a ${trip.endDate}.
Tipo: ${trip.tripType || 'lazer'}
Ocasiões necessárias: ${JSON.stringify(trip.occasionsNeeded || [])}

Guarda-roupa disponível:
${JSON.stringify(wardrobe.map(item => ({ id: item.id, name: item.name, category: item.category, color: item.color, season: item.season })))}

Sugira os IDs das peças ideais para esta viagem, priorizando versatilidade e combinações múltiplas. Responda em JSON:
{
  "suggestedItemIds": number[],
  "reasoning": string
}`
            }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "trip_suggestions",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  suggestedItemIds: { type: "array", items: { type: "number" } },
                  reasoning: { type: "string" }
                },
                required: ["suggestedItemIds", "reasoning"],
                additionalProperties: false
              }
            }
          }
        });
        
        const suggestionsContent = response.choices[0].message.content;
        const suggestions = JSON.parse(typeof suggestionsContent === 'string' ? suggestionsContent : JSON.stringify(suggestionsContent) || "{}");
        
        for (const itemId of suggestions.suggestedItemIds) {
          await db.insert(tripItems).values({
            tripId: input.tripId,
            wardrobeItemId: itemId,
            aiReason: suggestions.reasoning,
          });
        }
        
        return { success: true, suggestions };
      }),
  }),

  // Outfits router
  outfits: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      
      return db.select()
        .from(outfits)
        .where(eq(outfits.userId, ctx.user.id))
        .orderBy(desc(outfits.createdAt));
    }),
    
    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        itemIds: z.array(z.number()),
        occasion: z.string().optional(),
        season: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const result = await db.insert(outfits).values({
          userId: ctx.user.id,
          name: input.name,
          itemIds: input.itemIds,
          occasion: input.occasion,
          season: input.season,
          notes: input.notes,
        });
        
        return { success: true, id: result[0].insertId };
      }),
    
    generateSuggestion: protectedProcedure
      .input(z.object({
        occasion: z.string(),
        weather: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const wardrobe = await db.select()
          .from(wardrobeItems)
          .where(eq(wardrobeItems.userId, ctx.user.id));
        
        if (wardrobe.length === 0) {
          return { success: false, message: "Adicione peças ao seu guarda-roupa primeiro!" };
        }
        
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `Você é um estilista pessoal. Crie combinações de looks usando as peças disponíveis no guarda-roupa do usuário.`
            },
            {
              role: "user",
              content: `Crie um look para: ${input.occasion}
${input.weather ? `Clima: ${input.weather}` : ''}

Peças disponíveis:
${JSON.stringify(wardrobe.map(item => ({ id: item.id, name: item.name, category: item.category, color: item.color })))}

Responda em JSON:
{
  "outfitName": string,
  "itemIds": number[],
  "description": string,
  "stylingTips": string[]
}`
            }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "outfit_suggestion",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  outfitName: { type: "string" },
                  itemIds: { type: "array", items: { type: "number" } },
                  description: { type: "string" },
                  stylingTips: { type: "array", items: { type: "string" } }
                },
                required: ["outfitName", "itemIds", "description", "stylingTips"],
                additionalProperties: false
              }
            }
          }
        });
        
        const suggestionContent = response.choices[0].message.content;
        const suggestion = JSON.parse(typeof suggestionContent === 'string' ? suggestionContent : JSON.stringify(suggestionContent) || "{}");
        
        return { success: true, suggestion };
      }),
  }),

  // Challenges router
  challenges: router({
    available: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      
      return db.select()
        .from(challenges)
        .where(eq(challenges.isActive, true));
    }),
    
    userChallenges: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      
      return db.select()
        .from(userChallenges)
        .where(eq(userChallenges.userId, ctx.user.id));
    }),
    
    join: protectedProcedure
      .input(z.object({ challengeId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        await db.insert(userChallenges).values({
          userId: ctx.user.id,
          challengeId: input.challengeId,
        });
        
        return { success: true };
      }),
  }),

  // Social/Trends router
  social: router({
    getTrends: protectedProcedure.query(async () => {
      // Return mock trends for now - in production would fetch from social APIs
      return [
        {
          id: 1,
          trendName: "Quiet Luxury",
          description: "Minimalismo sofisticado com peças de qualidade e cores neutras",
          platform: "Instagram",
          hashtag: "quietluxury",
          imageUrl: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400",
          engagementScore: 9500,
        },
        {
          id: 2,
          trendName: "Coastal Grandmother",
          description: "Estilo relaxado inspirado em Nancy Meyers com linho e tons terrosos",
          platform: "TikTok",
          hashtag: "coastalgrandmother",
          imageUrl: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=400",
          engagementScore: 8200,
        },
        {
          id: 3,
          trendName: "Mob Wife Aesthetic",
          description: "Glamour italiano com peles, animal print e joias statement",
          platform: "TikTok",
          hashtag: "mobwife",
          imageUrl: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400",
          engagementScore: 7800,
        },
        {
          id: 4,
          trendName: "Cherry Red",
          description: "A cor do momento: vermelho cereja em todas as peças",
          platform: "Instagram",
          hashtag: "cherryred",
          imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400",
          engagementScore: 6500,
        },
      ];
    }),
    
    refreshTrends: protectedProcedure.mutation(async () => {
      // In production, this would fetch fresh data from social media APIs
      return { success: true };
    }),
  }),

  // Virtual Try-On router (Provador Virtual)
  virtualTryOn: router({
    // Gerar imagem de try-on com múltiplas peças do guarda-roupa
    tryOnWardrobe: protectedProcedure
      .input(z.object({
        userPhotoUrl: z.string(), // Foto do usuário
        wardrobeItemIds: z.array(z.number()), // IDs das peças do guarda-roupa
        shirtStyle: z.enum(["tucked", "untucked"]).optional(), // Estilo da camisa
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        if (input.wardrobeItemIds.length === 0) {
          throw new Error("Selecione pelo menos uma peça");
        }
        
        // Buscar todas as peças selecionadas do guarda-roupa
        const items = await db.select()
          .from(wardrobeItems)
          .where(and(
            inArray(wardrobeItems.id, input.wardrobeItemIds),
            eq(wardrobeItems.userId, ctx.user.id)
          ));
        
        if (items.length === 0) {
          throw new Error("Nenhuma peça encontrada no seu guarda-roupa");
        }
        
        const { generateImage } = await import("./_core/imageGeneration");
        
        // Criar descrição de todas as peças para o prompt
        const clothingDescriptions = items.map(item => 
          `${item.name} (${item.color || ''} ${item.category || ''})`
        ).join(', ');
        
        // Categorizar as peças
        const tops = items.filter(item => ['top', 'outerwear'].includes(item.category || ''));
        const bottoms = items.filter(item => item.category === 'bottom');
        const others = items.filter(item => !['top', 'outerwear', 'bottom'].includes(item.category || ''));
        
        // Criar prompt detalhado para look completo
        let outfitDescription = 'Complete outfit: ';
        if (tops.length > 0) {
          outfitDescription += `On top: ${tops.map(t => `${t.name} (${t.color})`).join(' with ')}. `;
        }
        if (bottoms.length > 0) {
          outfitDescription += `On bottom: ${bottoms.map(b => `${b.name} (${b.color})`).join(' with ')}. `;
        }
        if (others.length > 0) {
          outfitDescription += `Also wearing: ${others.map(o => `${o.name} (${o.color})`).join(', ')}. `;
        }
        
        // Coletar todas as imagens das peças
        const clothingImages = items
          .filter(item => item.imageUrl)
          .map(item => ({ url: item.imageUrl!, mimeType: "image/jpeg" as const }));
        
        // Criar lista detalhada de peças para o prompt
        const itemsList = items.map((item, index) => 
          `${index + 1}. ${item.name} - ${item.color || 'cor não especificada'} (categoria: ${item.category || 'geral'})`
        ).join('\n');
        
        // Criar descrição textual detalhada das peças
        const topDescription = tops.length > 0 
          ? tops.map(t => `${t.name} (cor: ${t.color || 'não especificada'})`).join(' combinado com ')
          : '';
        const bottomDescription = bottoms.length > 0
          ? bottoms.map(b => `${b.name} (cor: ${b.color || 'não especificada'})`).join(' combinado com ')
          : '';
        const otherDescription = others.length > 0
          ? others.map(o => `${o.name} (cor: ${o.color || 'não especificada'})`).join(', ')
          : '';
        
        // Gerar imagem de try-on usando API FASHN
        // Abordagem: usar API externa especializada para garantir fidelidade da foto do usuário
        const { generateMultiGarmentTryOn } = await import("./_core/virtualTryOn");
        
        // Extrair URLs das imagens das peças
        const garmentImageUrls = items
          .filter(item => item.imageUrl)
          .map(item => item.imageUrl!);
        
        try {
          // Tentar usar API FASHN (modo premium)
          const result = await generateMultiGarmentTryOn(
            input.userPhotoUrl,
            garmentImageUrls,
            {
              mode: "quality", // Usar modo de maior qualidade
              category: "auto", // Detectar automaticamente a categoria
              garmentPhotoType: "auto" // Detectar automaticamente o tipo de foto
            }
          );
          
          return {
            success: true,
            tryOnImageUrl: result.imageUrl,
            itemNames: items.map(i => i.name),
            itemCount: items.length,
            mode: "premium" as const,
          };
        } catch (error) {
          // Fallback: usar IA genérica (modo demo)
          console.warn("[Virtual Try-On] FASHN API failed, falling back to generic AI:", error);
          
          // Coletar todas as imagens das peças
          const clothingImages = items
            .filter(item => item.imageUrl)
            .map(item => ({ url: item.imageUrl!, mimeType: "image/jpeg" as const }));
          
          const allImages = [
            { url: input.userPhotoUrl, mimeType: "image/jpeg" as const },
            ...clothingImages
          ];
          
          // Criar descrição das peças
          const topDescription = tops.length > 0 
            ? tops.map(t => `${t.name} (cor: ${t.color || 'não especificada'})`).join(' combinado com ')
            : '';
          const bottomDescription = bottoms.length > 0
            ? bottoms.map(b => `${b.name} (cor: ${b.color || 'não especificada'})`).join(' combinado com ')
            : '';
          const otherDescription = others.length > 0
            ? others.map(o => `${o.name} (cor: ${o.color || 'não especificada'})`).join(', ')
            : '';
          
          const fallbackResult = await generateImage({
            prompt: `MODO DEMO - Virtual try-on genérico:

Mostre uma pessoa vestindo as seguintes roupas:
${topDescription ? `- Parte de cima: ${topDescription}` : ''}
${bottomDescription ? `- Parte de baixo: ${bottomDescription}` : ''}
${otherDescription ? `- Acessórios: ${otherDescription}` : ''}

Estilo: fotografia de moda profissional, fundo neutro, iluminação suave.

NOTA: Esta é uma versão demo com avatar genérico. Para usar sua própria foto, configure a API FASHN.`,
            originalImages: allImages
          });
          
          return {
            success: true,
            tryOnImageUrl: fallbackResult.url,
            itemNames: items.map(i => i.name),
            itemCount: items.length,
            mode: "demo" as const,
            warning: "Modo demo: usando avatar genérico. Configure FAL_KEY para usar sua foto real."
          };
        }
      }),
    
    // Gerar imagem de try-on com peça de URL externa (lojas online)
    tryOnExternal: protectedProcedure
      .input(z.object({
        userPhotoUrl: z.string(), // Foto do usuário
        clothingImageUrl: z.string().optional(), // URL da imagem da roupa (opcional)
        clothingImageBase64: z.string().optional(), // Imagem base64 da roupa (alternativa)
        clothingDescription: z.string(), // Descrição da peça
      }))
      .mutation(async ({ input }) => {
        const { generateImage } = await import("./_core/imageGeneration");
        
        let clothingImageUrl = input.clothingImageUrl;
        
        // Se recebeu base64, fazer upload para S3 primeiro
        if (input.clothingImageBase64) {
          const base64Data = input.clothingImageBase64.replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          const fileName = `tryon-clothing/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
          
          const { url } = await storagePut(fileName, buffer, 'image/jpeg');
          clothingImageUrl = url;
        }
        
        if (!clothingImageUrl) {
          throw new Error("Imagem da roupa é necessária");
        }
        
        // Gerar imagem de try-on usando IA
        const result = await generateImage({
          prompt: `Virtual try-on: Show this person wearing the clothing item shown in the second image. The clothing is: ${input.clothingDescription}. Keep the person's face and body exactly the same, only change the clothing. Professional fashion photography style.`,
          originalImages: [
            { url: input.userPhotoUrl, mimeType: "image/jpeg" },
            { url: clothingImageUrl, mimeType: "image/jpeg" }
          ]
        });
        
        return {
          success: true,
          tryOnImageUrl: result.url,
        };
      }),
    
    // Salvar foto do usuário para try-on
    saveUserPhoto: protectedProcedure
      .input(z.object({
        photoBase64: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        // Fazer upload da foto para S3
        const base64Data = input.photoBase64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const fileName = `tryon-photos/${ctx.user.id}-${Date.now()}.jpg`;
        
        const { url } = await storagePut(fileName, buffer, 'image/jpeg');
        
        // Atualizar o perfil do usuário com a foto
        await db.update(users)
          .set({ mirrorPhotoUrl: url })
          .where(eq(users.id, ctx.user.id));
        
        return { success: true, photoUrl: url };
      }),
  }),

  // Event Look Suggestion router (Sugestão de Looks por Evento)
  eventLooks: router({
    // Sugerir looks baseados na descrição do evento
    suggest: protectedProcedure
      .input(z.object({
        eventDescription: z.string(), // Descrição do evento
        eventDate: z.string().optional(), // Data do evento
        dressCode: z.string().optional(), // Código de vestimenta
        budget: z.number().optional(), // Orçamento para novas peças
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        // Buscar peças do guarda-roupa do usuário
        const wardrobe = await db.select()
          .from(wardrobeItems)
          .where(eq(wardrobeItems.userId, ctx.user.id));
        
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `Você é um estilista pessoal especializado em criar looks para eventos. Sua tarefa é sugerir combinações usando peças do guarda-roupa do usuário E sugerir peças complementares de lojas online que completariam o look.

Sempre responda em português do Brasil.`
            },
            {
              role: "user",
              content: `Crie sugestões de looks para este evento:

Evento: ${input.eventDescription}
${input.eventDate ? `Data: ${input.eventDate}` : ''}
${input.dressCode ? `Dress Code: ${input.dressCode}` : ''}
${input.budget ? `Orçamento para novas peças: R$ ${input.budget}` : ''}

Peças disponíveis no guarda-roupa:
${wardrobe.length > 0 ? JSON.stringify(wardrobe.map(item => ({
  id: item.id,
  name: item.name,
  category: item.category,
  color: item.color,
  brand: item.brand,
  imageUrl: item.imageUrl
}))) : 'Guarda-roupa vazio'}

Responda em JSON com o seguinte formato:
{
  "eventAnalysis": {
    "formality": string,
    "suggestedStyle": string,
    "colorPalette": string[]
  },
  "wardrobeLooks": [
    {
      "lookName": string,
      "description": string,
      "wardrobeItemIds": number[],
      "missingPieces": string[],
      "stylingTips": string[]
    }
  ],
  "shoppingSuggestions": [
    {
      "itemName": string,
      "category": string,
      "description": string,
      "estimatedPrice": string,
      "whereToBuy": string[],
      "whyRecommended": string
    }
  ],
  "completeLookIdea": {
    "description": string,
    "fromWardrobe": string[],
    "toBuy": string[]
  }
}`
            }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "event_look_suggestion",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  eventAnalysis: {
                    type: "object",
                    properties: {
                      formality: { type: "string" },
                      suggestedStyle: { type: "string" },
                      colorPalette: { type: "array", items: { type: "string" } }
                    },
                    required: ["formality", "suggestedStyle", "colorPalette"],
                    additionalProperties: false
                  },
                  wardrobeLooks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        lookName: { type: "string" },
                        description: { type: "string" },
                        wardrobeItemIds: { type: "array", items: { type: "number" } },
                        missingPieces: { type: "array", items: { type: "string" } },
                        stylingTips: { type: "array", items: { type: "string" } }
                      },
                      required: ["lookName", "description", "wardrobeItemIds", "missingPieces", "stylingTips"],
                      additionalProperties: false
                    }
                  },
                  shoppingSuggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        itemName: { type: "string" },
                        category: { type: "string" },
                        description: { type: "string" },
                        estimatedPrice: { type: "string" },
                        whereToBuy: { type: "array", items: { type: "string" } },
                        whyRecommended: { type: "string" }
                      },
                      required: ["itemName", "category", "description", "estimatedPrice", "whereToBuy", "whyRecommended"],
                      additionalProperties: false
                    }
                  },
                  completeLookIdea: {
                    type: "object",
                    properties: {
                      description: { type: "string" },
                      fromWardrobe: { type: "array", items: { type: "string" } },
                      toBuy: { type: "array", items: { type: "string" } }
                    },
                    required: ["description", "fromWardrobe", "toBuy"],
                    additionalProperties: false
                  }
                },
                required: ["eventAnalysis", "wardrobeLooks", "shoppingSuggestions", "completeLookIdea"],
                additionalProperties: false
              }
            }
          }
        });
        
        const suggestionContent = response.choices[0].message.content;
        const suggestion = JSON.parse(typeof suggestionContent === 'string' ? suggestionContent : JSON.stringify(suggestionContent) || "{}");
        
        // Enriquecer com as imagens das peças do guarda-roupa
        const wardrobeMap = new Map(wardrobe.map(item => [item.id, item]));
        
        return {
          success: true,
          suggestion,
          wardrobeItems: wardrobe.map(item => ({
            id: item.id,
            name: item.name,
            category: item.category,
            color: item.color,
            imageUrl: item.imageUrl
          }))
        };
      }),
  }),

  // Style Analysis router
  styleAnalysis: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return null;
      
      const result = await db.select()
        .from(styleAnalysis)
        .where(eq(styleAnalysis.userId, ctx.user.id))
        .limit(1);
      
      return result[0] || null;
    }),
    
    analyze: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const wardrobe = await db.select()
        .from(wardrobeItems)
        .where(eq(wardrobeItems.userId, ctx.user.id));
      
      if (wardrobe.length < 5) {
        return { success: false, message: "Adicione pelo menos 5 peças ao seu guarda-roupa para uma análise completa." };
      }
      
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Você é um consultor de moda especializado em análise de estilo pessoal. Analise o guarda-roupa do usuário e identifique seu perfil de estilo.`
          },
          {
            role: "user",
            content: `Analise este guarda-roupa e identifique o perfil de estilo:
${JSON.stringify(wardrobe.map(item => ({ name: item.name, category: item.category, color: item.color, brand: item.brand })))}

Responda em JSON:
{
  "dominantColors": string[],
  "favoriteCategories": string[],
  "styleProfile": {
    "primaryStyle": string,
    "secondaryStyle": string,
    "personality": string
  },
  "wardrobeGaps": {
    "missingBasics": string[],
    "suggestedPurchases": string[]
  },
  "sustainabilityScore": number
}`
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "style_analysis",
            strict: true,
            schema: {
              type: "object",
              properties: {
                dominantColors: { type: "array", items: { type: "string" } },
                favoriteCategories: { type: "array", items: { type: "string" } },
                styleProfile: {
                  type: "object",
                  properties: {
                    primaryStyle: { type: "string" },
                    secondaryStyle: { type: "string" },
                    personality: { type: "string" }
                  },
                  required: ["primaryStyle", "secondaryStyle", "personality"],
                  additionalProperties: false
                },
                wardrobeGaps: {
                  type: "object",
                  properties: {
                    missingBasics: { type: "array", items: { type: "string" } },
                    suggestedPurchases: { type: "array", items: { type: "string" } }
                  },
                  required: ["missingBasics", "suggestedPurchases"],
                  additionalProperties: false
                },
                sustainabilityScore: { type: "number" }
              },
              required: ["dominantColors", "favoriteCategories", "styleProfile", "wardrobeGaps", "sustainabilityScore"],
              additionalProperties: false
            }
          }
        }
      });
      
      const analysisContent = response.choices[0].message.content;
      const analysis = JSON.parse(typeof analysisContent === 'string' ? analysisContent : JSON.stringify(analysisContent) || "{}");
      
      const existing = await db.select()
        .from(styleAnalysis)
        .where(eq(styleAnalysis.userId, ctx.user.id))
        .limit(1);
      
      if (existing.length > 0) {
        await db.update(styleAnalysis)
          .set({
            ...analysis,
            lastAnalyzedAt: new Date(),
          })
          .where(eq(styleAnalysis.userId, ctx.user.id));
      } else {
        await db.insert(styleAnalysis).values({
          userId: ctx.user.id,
          ...analysis,
        });
      }
      
      return { success: true, analysis };
    }),
  }),
  
  capsules: capsulesRouter,
  
  // Look Editor router
  lookEditor: router({
    // Gerar look realista a partir da composição do canvas
    generateFromCanvas: protectedProcedure
      .input(z.object({
        userPhotoUrl: z.string(),
        items: z.array(z.object({
          wardrobeItemId: z.number(),
          name: z.string(),
          category: z.string(),
          styleOptions: z.object({
            tucked: z.boolean(),
            layerOrder: z.number(),
          }),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        if (input.items.length === 0) {
          throw new Error("Adicione pelo menos uma peça ao canvas");
        }
        
        // Buscar detalhes completos das peças
        const itemIds = input.items.map(i => i.wardrobeItemId);
        const wardrobeItemsData = await db.select()
          .from(wardrobeItems)
          .where(and(
            inArray(wardrobeItems.id, itemIds),
            eq(wardrobeItems.userId, ctx.user.id)
          ));
        
        if (wardrobeItemsData.length === 0) {
          throw new Error("Nenhuma peça encontrada no seu guarda-roupa");
        }
        
        // Ordenar peças por layerOrder (camadas)
        const sortedItems = [...input.items].sort((a, b) => a.styleOptions.layerOrder - b.styleOptions.layerOrder);
        
        // Criar descrição detalhada considerando as opções de estilo
        const itemDescriptions = sortedItems.map(item => {
          const dbItem = wardrobeItemsData.find(w => w.id === item.wardrobeItemId);
          if (!dbItem) return '';
          
          let description = `${dbItem.name} (${dbItem.color || 'cor não especificada'})`;
          
          // Adicionar estilo específico para tops
          if (item.category === 'top' || item.category === 'outerwear') {
            description += item.styleOptions.tucked 
              ? ' worn tucked in (inside the pants/skirt)'
              : ' worn untucked (outside the pants/skirt)';
          }
          
          return description;
        }).filter(Boolean);
        
        // Categorizar peças para prompt estruturado
        const tops = sortedItems.filter(i => ['top', 'outerwear'].includes(i.category));
        const bottoms = sortedItems.filter(i => i.category === 'bottom');
        const others = sortedItems.filter(i => !['top', 'outerwear', 'bottom'].includes(i.category));
        
        // Criar descrição por categoria
        const topDescription = tops.map(item => {
          const dbItem = wardrobeItemsData.find(w => w.id === item.wardrobeItemId);
          if (!dbItem) return '';
          const styleNote = item.styleOptions.tucked ? 'tucked inside' : 'worn outside';
          return `${dbItem.name} (${dbItem.color}) - ${styleNote}`;
        }).filter(Boolean).join(', ');
        
        const bottomDescription = bottoms.map(item => {
          const dbItem = wardrobeItemsData.find(w => w.id === item.wardrobeItemId);
          return dbItem ? `${dbItem.name} (${dbItem.color})` : '';
        }).filter(Boolean).join(', ');
        
        const otherDescription = others.map(item => {
          const dbItem = wardrobeItemsData.find(w => w.id === item.wardrobeItemId);
          return dbItem ? `${dbItem.name} (${dbItem.color})` : '';
        }).filter(Boolean).join(', ');
        
        const { generateImage } = await import("./_core/imageGeneration");
        
        // Coletar URLs das imagens das peças para usar como referência visual
        const clothingImages = wardrobeItemsData
          .filter(item => item.imageUrl)
          .map(item => ({
            url: item.imageUrl!,
            mimeType: "image/jpeg" as const
          }));
        
        // Gerar imagem com prompt detalhado E imagens de referência
        const result = await generateImage({
          prompt: `CRITICAL: This is a clothing try-on task. You MUST keep the EXACT SAME PERSON from the first image and dress them with the EXACT clothing items shown in the reference images.

=== PERSON TO KEEP (IMAGE 1) ===
The first image shows the person. Keep their:
- Exact face and facial features
- Exact body shape and proportions
- Exact skin tone
- Exact hair style and color
- Exact pose and position
- Same background and lighting

=== CLOTHING TO WEAR (IMAGES 2+) ===
The following images show the EXACT clothing items to wear.
You MUST replicate these items PRECISELY:
- Same colors, patterns, textures
- Same style, cut, and design details
- Same fabric appearance

Clothing details:
${bottomDescription ? `Lower body: ${bottomDescription}` : ''}
${topDescription ? `Upper body: ${topDescription}` : ''}
${otherDescription ? `Accessories: ${otherDescription}` : ''}

=== STYLING REQUIREMENTS ===
${tops.length > 0 ? tops.map(t => {
  const dbItem = wardrobeItemsData.find(w => w.id === t.wardrobeItemId);
  return `- ${dbItem?.name}: ${t.styleOptions.tucked ? 'MUST be tucked inside the ${bottoms.length > 0 ? bottoms[0].category : "bottom"}' : 'MUST be worn outside, NOT tucked in'}`;
}).join('\n') : ''}

=== CRITICAL REQUIREMENTS ===
1. The person's identity MUST remain 100% identical to image 1
2. The clothing items MUST be EXACT replicas of the reference images (images 2+)
3. DO NOT create "similar" clothing - use the EXACT items shown
4. All ${input.items.length} clothing pieces must be visible and properly fitted
5. Follow the tucked/untucked styling instructions precisely
6. Layer the clothing in the correct order (bottom to top)
7. Maintain photorealistic quality with natural lighting and shadows
8. DO NOT generate a different person
9. DO NOT change facial features, body type, or background
10. DO NOT improvise or create new clothing - ONLY use the exact items from the reference images`,
          originalImages: [
            { url: input.userPhotoUrl, mimeType: "image/jpeg" },
            ...clothingImages
          ]
        });
        
        return {
          success: true,
          lookImageUrl: result.url,
          itemCount: input.items.length,
        };
      }),
  }),

  // Image proxy to fix CORS issues
  imageProxy: router({
    get: publicProcedure
      .input(z.object({
        url: z.string().url(),
      }))
      .query(async ({ input, ctx }) => {
        try {
          const response = await fetch(input.url);
          if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
          }
          
          const buffer = await response.arrayBuffer();
          const base64 = Buffer.from(buffer).toString('base64');
          const contentType = response.headers.get('content-type') || 'image/jpeg';
          
          return {
            data: `data:${contentType};base64,${base64}`,
            contentType,
          };
        } catch (error) {
          console.error('Image proxy error:', error);
          throw new Error('Failed to load image through proxy');
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
