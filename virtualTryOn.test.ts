/**
 * Tests for Virtual Try-On integration with FASHN API
 */

import { describe, it, expect } from "vitest";
import { generateVirtualTryOn } from "./_core/virtualTryOn";

describe("Virtual Try-On Integration", () => {
  it("should validate FAL_KEY is configured", () => {
    expect(process.env.FAL_KEY).toBeDefined();
    expect(process.env.FAL_KEY).not.toBe("");
  });

  it("should generate a virtual try-on image", async () => {
    // Skip test if FAL_KEY is not configured
    if (!process.env.FAL_KEY) {
      console.warn("Skipping test: FAL_KEY not configured");
      return;
    }

    // Test images (using public URLs from FASHN documentation)
    const modelImage = "https://utfs.io/f/wXFHUNfTHmLj4prvqbRMQ6JXFyUr3IT0avK2HSOmZWiAsxg9";
    const garmentImage = "https://utfs.io/f/wXFHUNfTHmLjtkhepmqOUnkr8XxZbNIFmRWldShDLu320TeC";

    // Call API
    const result = await generateVirtualTryOn({
      modelImage,
      garmentImage,
      category: "auto",
      mode: "performance", // Use performance mode for faster testing
    });

    // Validate result
    expect(result).toBeDefined();
    expect(result.imageUrl).toBeDefined();
    expect(result.imageUrl).toMatch(/^https?:\/\//); // Should be a valid URL
    expect(result.requestId).toBeDefined();
    
    console.log("✅ Virtual try-on test passed!");
    console.log("Generated image URL:", result.imageUrl);
    console.log("Request ID:", result.requestId);
  }, 60000); // 60 second timeout for API call
});
