import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appRouter } from './routers';
import type { Context } from './_core/trpc';
import * as db from './db';

// Mock dependencies
vi.mock('./db');
vi.mock('./_core/imageGeneration');

describe('lookEditor router', () => {
  let mockContext: Context;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockContext = {
      user: {
        id: 1,
        openId: 'test-user',
        name: 'Test User',
        email: 'test@example.com',
        avatarUrl: null,
        role: 'user',
        createdAt: new Date(),
      },
      req: {} as any,
      res: {} as any,
    };
  });

  describe('generateFromCanvas', () => {
    it('should throw error if no items provided', async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(db.getDb).mockResolvedValue(mockDb as any);

      const caller = appRouter.createCaller(mockContext);

      await expect(
        caller.lookEditor.generateFromCanvas({
          userPhotoUrl: 'https://example.com/photo.jpg',
          items: [],
        })
      ).rejects.toThrow('Adicione pelo menos uma peça ao canvas');
    });

    it('should generate look with single item', async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            id: 1,
            userId: 1,
            name: 'Camiseta Branca',
            category: 'top',
            color: 'branco',
            imageUrl: 'https://example.com/shirt.jpg',
          },
        ]),
      };

      vi.mocked(db.getDb).mockResolvedValue(mockDb as any);

      const mockGenerateImage = vi.fn().mockResolvedValue({
        url: 'https://example.com/generated-look.jpg',
      });

      vi.doMock('./_core/imageGeneration', () => ({
        generateImage: mockGenerateImage,
      }));

      const caller = appRouter.createCaller(mockContext);

      const result = await caller.lookEditor.generateFromCanvas({
        userPhotoUrl: 'https://example.com/photo.jpg',
        items: [
          {
            wardrobeItemId: 1,
            name: 'Camiseta Branca',
            category: 'top',
            styleOptions: {
              tucked: false,
              layerOrder: 1,
            },
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.lookImageUrl).toBe('https://example.com/generated-look.jpg');
      expect(result.itemCount).toBe(1);
    });

    it('should handle tucked style option correctly', async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            id: 1,
            userId: 1,
            name: 'Blusa',
            category: 'top',
            color: 'azul',
            imageUrl: null,
          },
          {
            id: 2,
            userId: 1,
            name: 'Calça Jeans',
            category: 'bottom',
            color: 'azul escuro',
            imageUrl: null,
          },
        ]),
      };

      vi.mocked(db.getDb).mockResolvedValue(mockDb as any);

      const mockGenerateImage = vi.fn().mockResolvedValue({
        url: 'https://example.com/generated-look.jpg',
      });

      vi.doMock('./_core/imageGeneration', () => ({
        generateImage: mockGenerateImage,
      }));

      const caller = appRouter.createCaller(mockContext);

      const result = await caller.lookEditor.generateFromCanvas({
        userPhotoUrl: 'https://example.com/photo.jpg',
        items: [
          {
            wardrobeItemId: 2,
            name: 'Calça Jeans',
            category: 'bottom',
            styleOptions: {
              tucked: false,
              layerOrder: 1,
            },
          },
          {
            wardrobeItemId: 1,
            name: 'Blusa',
            category: 'top',
            styleOptions: {
              tucked: true, // Blusa por dentro
              layerOrder: 2,
            },
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.itemCount).toBe(2);

      // Verificar se o generateImage foi chamado
      expect(mockGenerateImage).toHaveBeenCalled();

      // Verificar se o prompt contém informação sobre tucked
      const callArgs = mockGenerateImage.mock.calls[0][0];
      expect(callArgs.prompt).toContain('tucked');
    });

    it('should respect layer order when generating prompt', async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            id: 1,
            userId: 1,
            name: 'Camiseta',
            category: 'top',
            color: 'branco',
          },
          {
            id: 2,
            userId: 1,
            name: 'Jaqueta',
            category: 'outerwear',
            color: 'preto',
          },
        ]),
      };

      vi.mocked(db.getDb).mockResolvedValue(mockDb as any);

      const mockGenerateImage = vi.fn().mockResolvedValue({
        url: 'https://example.com/generated-look.jpg',
      });

      vi.doMock('./_core/imageGeneration', () => ({
        generateImage: mockGenerateImage,
      }));

      const caller = appRouter.createCaller(mockContext);

      await caller.lookEditor.generateFromCanvas({
        userPhotoUrl: 'https://example.com/photo.jpg',
        items: [
          {
            wardrobeItemId: 2,
            name: 'Jaqueta',
            category: 'outerwear',
            styleOptions: {
              tucked: false,
              layerOrder: 2, // Camada superior
            },
          },
          {
            wardrobeItemId: 1,
            name: 'Camiseta',
            category: 'top',
            styleOptions: {
              tucked: false,
              layerOrder: 1, // Camada inferior
            },
          },
        ],
      });

      expect(mockGenerateImage).toHaveBeenCalled();
      
      // Verificar que as peças foram ordenadas corretamente no prompt
      const callArgs = mockGenerateImage.mock.calls[0][0];
      const prompt = callArgs.prompt;
      
      // A camiseta (layer 1) deve aparecer antes da jaqueta (layer 2) no prompt
      const camisetaIndex = prompt.indexOf('Camiseta');
      const jaquetaIndex = prompt.indexOf('Jaqueta');
      
      expect(camisetaIndex).toBeLessThan(jaquetaIndex);
    });
  });
});
