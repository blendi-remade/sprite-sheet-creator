import { fal } from "@fal-ai/client";
import { NextRequest, NextResponse } from "next/server";

// Configure fal client with API key from environment
fal.config({
  credentials: process.env.FAL_KEY,
});

const LAYER1_PROMPT = (characterPrompt: string) =>
  `Create the SKY/BACKDROP layer for a side-scrolling pixel art game parallax background.

This is for a character: "${characterPrompt}"

Create an environment that fits this character's world. This is the FURTHEST layer - only sky and very distant elements (distant mountains, clouds, horizon).

Style: Pixel art, 32-bit retro game aesthetic, matching the character's style..
This is a wide panoramic scene.`;

const LAYER2_PROMPT = `Create the MIDDLE layer of a 3-layer parallax background for a side-scrolling pixel art game.

I've sent you images of: 1) the character, 2) the background/sky layer already created.

Create the character's ICONIC/CANONICAL location from their story. Use their most recognizable setting - home village, famous landmarks, signature battlegrounds.
Examples: Naruto → Hidden Leaf Village with Hokage monument, Goku → World Tournament arena, Link → Hyrule castle.

Elements should fill the frame from middle down to bottom.

Style: Pixel art matching the other images.
IMPORTANT: Use a transparent background (checkerboard pattern) so this layer can overlay the others.`;

const LAYER3_PROMPT = `Create the FOREGROUND layer of a 3-layer parallax background for a side-scrolling pixel art game.

I've sent you images of: 1) the character, 2) the background/sky layer, 3) the middle layer.

Create the closest foreground elements (ground, grass, rocks, platforms - whatever fits the character's world) that complete the scene.

Style: Pixel art matching the other images.
IMPORTANT: Use a transparent background (checkerboard pattern) so this layer can overlay the others.`;

const ISOMETRIC_MAP_PROMPT = (characterPrompt: string) =>
  `Create a large, detailed top-down isometric pixel art game world map for a character: "${characterPrompt}". Do not place the character themselves on the map.

Style: Classic RPG top-down map, 3/4 overhead perspective.

The map should include a cohesive world with:
- Winding dirt/stone paths connecting areas
- A small body of water (pond, river, or stream)
- A few small buildings or structures that fit the character's world
- Rocky areas or hills
- Various terrain types for visual interest

This is a single large continuous map image (NOT tiled, NOT a tileset). It should look like a complete, explorable game world viewed from above.

Use detailed 32-bit pixel art style. Make it colorful and inviting. Fill the entire image with map content - no empty borders.`;

async function generateLayer(
  prompt: string,
  imageUrls: string[],
  aspectRatio: string = "21:9"
): Promise<{ url: string; width: number; height: number }> {
  const result = await fal.subscribe("fal-ai/nano-banana-pro/edit", {
    input: {
      prompt,
      image_urls: imageUrls,
      num_images: 1,
      aspect_ratio: aspectRatio,
      output_format: "png",
      resolution: "1K",
    },
  });

  const data = result.data as {
    images: Array<{ url: string; width: number; height: number }>;
  };

  if (!data.images || data.images.length === 0) {
    throw new Error("No image generated");
  }

  return {
    url: data.images[0].url,
    width: data.images[0].width,
    height: data.images[0].height,
  };
}

async function removeBackground(
  imageUrl: string
): Promise<{ url: string; width: number; height: number }> {
  const result = await fal.subscribe("fal-ai/bria/background/remove", {
    input: {
      image_url: imageUrl,
    },
  });

  const data = result.data as {
    image: { url: string; width: number; height: number };
  };

  if (!data.image) {
    throw new Error("Background removal failed");
  }

  return {
    url: data.image.url,
    width: data.image.width,
    height: data.image.height,
  };
}

export async function POST(request: NextRequest) {
  try {
    const {
      characterImageUrl,
      characterPrompt,
      mode,             // Optional: "side-scroller" | "isometric"
      regenerateLayer,  // Optional: 1, 2, or 3 to regenerate only that layer
      existingLayers,   // Optional: { layer1Url, layer2Url, layer3Url } for single layer regen
    } = await request.json();

    if (!characterImageUrl || !characterPrompt) {
      return NextResponse.json(
        { error: "Character image URL and prompt are required" },
        { status: 400 }
      );
    }

    // Isometric map generation - single large map image
    if (mode === "isometric") {
      console.log("Generating isometric map...");
      const map = await generateLayer(
        ISOMETRIC_MAP_PROMPT(characterPrompt),
        [characterImageUrl],
        "1:1"
      );
      return NextResponse.json({
        mapUrl: map.url,
        width: map.width,
        height: map.height,
      });
    }

    // Single layer regeneration
    if (regenerateLayer && existingLayers) {
      if (regenerateLayer === 1) {
        console.log("Regenerating layer 1 (sky/background)...");
        const layer1 = await generateLayer(
          LAYER1_PROMPT(characterPrompt),
          [characterImageUrl],
          "21:9"
        );
        return NextResponse.json({
          layer1Url: layer1.url,
          layer2Url: existingLayers.layer2Url,
          layer3Url: existingLayers.layer3Url,
          width: layer1.width,
          height: layer1.height,
        });
      } else if (regenerateLayer === 2) {
        console.log("Regenerating layer 2 (midground)...");
        const layer2Raw = await generateLayer(
          LAYER2_PROMPT,
          [characterImageUrl, existingLayers.layer1Url],
          "21:9"
        );
        console.log("Removing background from layer 2...");
        const layer2 = await removeBackground(layer2Raw.url);
        return NextResponse.json({
          layer1Url: existingLayers.layer1Url,
          layer2Url: layer2.url,
          layer3Url: existingLayers.layer3Url,
          width: layer2.width,
          height: layer2.height,
        });
      } else if (regenerateLayer === 3) {
        console.log("Regenerating layer 3 (foreground)...");
        const layer3Raw = await generateLayer(
          LAYER3_PROMPT,
          [characterImageUrl, existingLayers.layer1Url, existingLayers.layer2Url],
          "21:9"
        );
        console.log("Removing background from layer 3...");
        const layer3 = await removeBackground(layer3Raw.url);
        return NextResponse.json({
          layer1Url: existingLayers.layer1Url,
          layer2Url: existingLayers.layer2Url,
          layer3Url: layer3.url,
          width: layer3.width,
          height: layer3.height,
        });
      }
    }

    // Generate all layers
    // Layer 1: Sky/Background (furthest)
    console.log("Generating layer 1 (sky/background)...");
    const layer1 = await generateLayer(
      LAYER1_PROMPT(characterPrompt),
      [characterImageUrl],
      "21:9"
    );

    // Layer 2: Midground - needs character + layer 1 as reference
    console.log("Generating layer 2 (midground)...");
    const layer2Raw = await generateLayer(
      LAYER2_PROMPT,
      [characterImageUrl, layer1.url],
      "21:9"
    );

    // Remove background from layer 2
    console.log("Removing background from layer 2...");
    const layer2 = await removeBackground(layer2Raw.url);

    // Layer 3: Foreground - needs character + layer 1 + layer 2 as reference
    console.log("Generating layer 3 (foreground)...");
    const layer3Raw = await generateLayer(
      LAYER3_PROMPT,
      [characterImageUrl, layer1.url, layer2.url],
      "21:9"
    );

    // Remove background from layer 3
    console.log("Removing background from layer 3...");
    const layer3 = await removeBackground(layer3Raw.url);

    return NextResponse.json({
      layer1Url: layer1.url,
      layer2Url: layer2.url,
      layer3Url: layer3.url,
      // Also return dimensions (they should all be the same)
      width: layer1.width,
      height: layer1.height,
    });
  } catch (error) {
    console.error("Error generating background layers:", error);
    return NextResponse.json(
      { error: "Failed to generate background layers" },
      { status: 500 }
    );
  }
}
