import { fal } from "@fal-ai/client";
import { NextRequest, NextResponse } from "next/server";

// Configure fal client with API key from environment
fal.config({
  credentials: process.env.FAL_KEY,
});

const WALK_SPRITE_PROMPT = `Create a 6-frame pixel art walk cycle sprite sheet of this character.

Arrange the 6 frames in a 2x3 grid (2 rows, 3 columns) on white background. The character is walking to the right.

Top row (frames 1-3):
Frame 1: Right leg forward, left leg back - stride
Frame 2: Legs very close together, passing/crossing
Frame 3: Left leg forward, right leg back - opposite stride

Bottom row (frames 4-6):
Frame 4: Legs close together, passing/crossing
Frame 5: Right leg forward again - stride
Frame 6: Legs very close together, passing/crossing

Each frame shows a different phase of the walking motion. Stride frames have legs spread apart, passing frames have legs close together.

Use detailed 32-bit pixel art style with proper shading and highlights. Same character design in all frames.`;

const JUMP_SPRITE_PROMPT = `Create a 4-frame pixel art jump animation sprite sheet of this character.

Arrange the 4 frames in a 2x2 grid on white background. The character is jumping.

Top row (frames 1-2):
Frame 1 (top-left): Crouch/anticipation - character slightly crouched, knees bent, preparing to jump
Frame 2 (top-right): Rising - character in air, legs tucked up, arms up, ascending

Bottom row (frames 3-4):
Frame 3 (bottom-left): Apex/peak - character at highest point of jump, body stretched or tucked
Frame 4 (bottom-right): Landing - character landing, slight crouch to absorb impact

Use detailed 32-bit pixel art style with proper shading and highlights. Same character design in all frames. Character facing right.`;

const ATTACK_SPRITE_PROMPT = `Create a 4-frame pixel art attack animation sprite sheet of this character.

Arrange the 4 frames in a 2x2 grid on white background. The character is performing an attack that fits their design - could be a sword slash, magic spell, punch, kick, or energy blast depending on what suits the character best.

Top row (frames 1-2):
Frame 1 (top-left): Wind-up/anticipation - character preparing to attack, pulling back weapon or gathering energy
Frame 2 (top-right): Attack in motion - the strike or spell being unleashed

Bottom row (frames 3-4):
Frame 3 (bottom-left): Impact/peak - maximum extension of attack, weapon fully swung or spell at full power
Frame 4 (bottom-right): Recovery - returning to ready stance

Use detailed 32-bit pixel art style with proper shading and highlights. Same character design in all frames. Character facing right. Make the attack visually dynamic and exciting.`;

type SpriteType = "walk" | "jump" | "attack";

const PROMPTS: Record<SpriteType, string> = {
  walk: WALK_SPRITE_PROMPT,
  jump: JUMP_SPRITE_PROMPT,
  attack: ATTACK_SPRITE_PROMPT,
};

const ASPECT_RATIOS: Record<SpriteType, string> = {
  walk: "4:3",   // 2x3 grid
  jump: "1:1",   // 2x2 grid
  attack: "21:9", // 2x2 grid - ultra-wide for big spell effects
};

export async function POST(request: NextRequest) {
  try {
    const { characterImageUrl, type = "walk", customPrompt } = await request.json();

    if (!characterImageUrl) {
      return NextResponse.json(
        { error: "Character image URL is required" },
        { status: 400 }
      );
    }

    const spriteType = (type as SpriteType) || "walk";
    const prompt = customPrompt || PROMPTS[spriteType] || PROMPTS.walk;
    const aspectRatio = ASPECT_RATIOS[spriteType] || ASPECT_RATIOS.walk;

    const result = await fal.subscribe("fal-ai/nano-banana-pro/edit", {
      input: {
        prompt,
        image_urls: [characterImageUrl],
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
      return NextResponse.json(
        { error: "No sprite sheet generated" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      imageUrl: data.images[0].url,
      width: data.images[0].width,
      height: data.images[0].height,
      type: spriteType,
    });
  } catch (error) {
    console.error("Error generating sprite sheet:", error);
    return NextResponse.json(
      { error: "Failed to generate sprite sheet" },
      { status: 500 }
    );
  }
}
