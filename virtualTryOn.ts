/**
 * Virtual Try-On Integration using FASHN API via Fal.ai
 * 
 * This module provides server-side integration with FASHN's virtual try-on API
 * to avoid CORS issues and protect API keys.
 * 
 * API Documentation: https://fal.ai/models/fal-ai/fashn/tryon/v1.5/api
 * Pricing: $0.075 per generation (576x864 resolution)
 */

import { fal } from "@fal-ai/client";

// Configure Fal.ai client with API key from environment
if (process.env.FAL_KEY) {
  fal.config({
    credentials: process.env.FAL_KEY,
  });
}

export interface VirtualTryOnInput {
  /**
   * URL or base64 of the model image (user's photo)
   */
  modelImage: string;
  
  /**
   * URL or base64 of the garment image (clothing item)
   */
  garmentImage: string;
  
  /**
   * Category of the garment to try-on
   * 'auto' will attempt to automatically detect the category
   */
  category?: "tops" | "bottoms" | "one-pieces" | "auto";
  
  /**
   * Mode of operation
   * - 'performance': faster but may sacrifice quality
   * - 'balanced': balance between speed and quality
   * - 'quality': slower but produces higher quality results
   */
  mode?: "performance" | "balanced" | "quality";
  
  /**
   * Type of garment photo to optimize internal parameters
   * - 'model': photos of garments on a model
   * - 'flat-lay': flat-lay or ghost mannequin images
   * - 'auto': automatically detect the photo type
   */
  garmentPhotoType?: "auto" | "model" | "flat-lay";
}

export interface VirtualTryOnOutput {
  /**
   * URL of the generated try-on image
   */
  imageUrl: string;
  
  /**
   * Request ID for tracking
   */
  requestId: string;
}

/**
 * Generate a virtual try-on image using FASHN API
 * 
 * @param input - Configuration for the try-on generation
 * @returns The generated image URL and request ID
 * @throws Error if API key is not configured or if the API request fails
 */
export async function generateVirtualTryOn(
  input: VirtualTryOnInput
): Promise<VirtualTryOnOutput> {
  // Validate API key
  if (!process.env.FAL_KEY) {
    throw new Error(
      "FAL_KEY environment variable is not set. Please configure it to use virtual try-on."
    );
  }

  try {
    // Call FASHN API via Fal.ai
    const result = await fal.subscribe("fal-ai/fashn/tryon/v1.5", {
      input: {
        model_image: input.modelImage,
        garment_image: input.garmentImage,
        category: input.category || "auto",
        mode: input.mode || "balanced",
        garment_photo_type: input.garmentPhotoType || "auto",
        // Use PNG for highest quality
        output_format: "png",
        // Generate single image
        num_samples: 1,
        // Enable segmentation-free mode for better results
        segmentation_free: true,
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          update.logs.map((log) => log.message).forEach(console.log);
        }
      },
    });

    // Extract image URL from result
    const imageUrl = result.data.images[0]?.url;
    
    if (!imageUrl) {
      throw new Error("No image URL returned from FASHN API");
    }

    return {
      imageUrl,
      requestId: result.requestId,
    };
  } catch (error) {
    console.error("[Virtual Try-On] Error generating try-on:", error);
    throw new Error(
      `Failed to generate virtual try-on: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Generate a virtual try-on with multiple garments
 * 
 * This function processes multiple garments sequentially, applying each one
 * on top of the previous result to create a complete outfit.
 * 
 * @param modelImage - URL or base64 of the user's photo
 * @param garmentImages - Array of garment image URLs or base64
 * @param options - Optional configuration for each try-on
 * @returns The final composed image URL
 */
export async function generateMultiGarmentTryOn(
  modelImage: string,
  garmentImages: string[],
  options?: {
    category?: VirtualTryOnInput["category"];
    mode?: VirtualTryOnInput["mode"];
    garmentPhotoType?: VirtualTryOnInput["garmentPhotoType"];
  }
): Promise<VirtualTryOnOutput> {
  if (garmentImages.length === 0) {
    throw new Error("At least one garment image is required");
  }

  // Process garments sequentially
  let currentModelImage = modelImage;
  let lastRequestId = "";

  for (const garmentImage of garmentImages) {
    const result = await generateVirtualTryOn({
      modelImage: currentModelImage,
      garmentImage,
      category: options?.category,
      mode: options?.mode,
      garmentPhotoType: options?.garmentPhotoType,
    });

    // Use the result as the model image for the next garment
    currentModelImage = result.imageUrl;
    lastRequestId = result.requestId;
  }

  return {
    imageUrl: currentModelImage,
    requestId: lastRequestId,
  };
}
