import { fal } from "@fal-ai/client";
import { NextRequest, NextResponse } from "next/server";
import { generateImage, ImageModel, GptImageQuality } from "../../lib/generate-image";

// Configure fal client with API key from environment
fal.config({
  credentials: process.env.FAL_KEY,
});

const CHARACTER_STYLE_PROMPT = `Generate a single character only, centered in the frame on a plain white background.
The character should be rendered in detailed 32-bit pixel art style (like PlayStation 1 / SNES era games).
Include proper shading, highlights, and anti-aliased edges for a polished look.
The character should have well-defined features, expressive details, and rich colors.
Show in a front-facing or 3/4 view pose, standing idle, suitable for sprite sheet animation.`;

const IMAGE_TO_PIXEL_PROMPT = `Transform this character into detailed 32-bit pixel art style (like PlayStation 1 / SNES era games).
IMPORTANT: Must be a FULL BODY shot showing the entire character from head to feet.
Keep the character centered in the frame on a plain white background.
Include proper shading, highlights, and anti-aliased edges for a polished look.
The character should have well-defined features, expressive details, and rich colors.
Show in a front-facing or 3/4 view pose, standing idle, suitable for sprite sheet animation.
Maintain the character's key features, colors, and identity while converting to pixel art.`;

export async function POST(request: NextRequest) {
  try {
    const { prompt, imageUrl, imageModel, gptImageQuality } = await request.json();
    const model: ImageModel = imageModel === "gpt-image-2" ? "gpt-image-2" : "nano-banana-pro";
    const quality: GptImageQuality | undefined =
      gptImageQuality === "low" || gptImageQuality === "medium" || gptImageQuality === "high"
        ? gptImageQuality
        : undefined;

    // Image-to-image mode: convert uploaded image to pixel art
    if (imageUrl) {
      const fullPrompt = prompt
        ? `${prompt}. ${IMAGE_TO_PIXEL_PROMPT}`
        : IMAGE_TO_PIXEL_PROMPT;

      const image = await generateImage({
        model,
        prompt: fullPrompt,
        imageUrls: [imageUrl],
        aspectRatio: "1:1",
        gptImageQuality: quality,
      });

      return NextResponse.json({
        imageUrl: image.url,
        width: image.width,
        height: image.height,
      });
    }

    // Text-to-image mode: generate from prompt
    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt or image URL is required" },
        { status: 400 }
      );
    }

    const fullPrompt = `${prompt}. ${CHARACTER_STYLE_PROMPT}`;

    const image = await generateImage({
      model,
      prompt: fullPrompt,
      aspectRatio: "1:1",
      gptImageQuality: quality,
    });

    return NextResponse.json({
      imageUrl: image.url,
      width: image.width,
      height: image.height,
    });
  } catch (error: unknown) {
    console.error("Error generating character:", error);
    // Log full error details for fal.ai validation errors
    if (error && typeof error === 'object' && 'body' in error) {
      console.error("Error body:", JSON.stringify((error as { body: unknown }).body, null, 2));
    }
    return NextResponse.json(
      { error: "Failed to generate character" },
      { status: 500 }
    );
  }
}
