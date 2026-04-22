import { fal } from "@fal-ai/client";
import { NextRequest, NextResponse } from "next/server";
import { generateImage, ImageModel, AspectRatio, GptImageQuality } from "../../lib/generate-image";

// Configure fal client with API key from environment
fal.config({
  credentials: process.env.FAL_KEY,
});

const WALK_SPRITE_PROMPT = `Create a 4-frame pixel art walk cycle sprite sheet of this character.

Arrange the 4 frames in a 2x2 grid on white background. The character is walking to the right.

Top row (frames 1-2):
Frame 1 (top-left): Right leg forward, left leg back - stride position
Frame 2 (top-right): Legs close together, passing/crossing - transition

Bottom row (frames 3-4):
Frame 3 (bottom-left): Left leg forward, right leg back - opposite stride
Frame 4 (bottom-right): Legs close together, passing/crossing - transition back

Each frame shows a different phase of the walking motion. This creates a smooth looping walk cycle.

Use detailed 32-bit pixel art style with proper shading and highlights. Same character design in all frames. Character facing right.`;

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

const IDLE_SPRITE_PROMPT = `Create a 4-frame pixel art idle/breathing animation sprite sheet of this character.

Arrange the 4 frames in a 2x2 grid on white background. The character is standing still but with subtle idle animation.

Top row (frames 1-2):
Frame 1 (top-left): Neutral standing pose - relaxed stance
Frame 2 (top-right): Slight inhale - chest/body rises subtly, maybe slight arm movement

Bottom row (frames 3-4):
Frame 3 (bottom-left): Full breath - slight upward posture
Frame 4 (bottom-right): Exhale - returning to neutral, slight settle

Keep movements SUBTLE - this is a gentle breathing/idle loop, not dramatic motion. Character should look alive but relaxed.

Use detailed 32-bit pixel art style with proper shading and highlights. Same character design in all frames. Character facing right.`;

// Isometric (top-down RPG) sprite prompts
const WALK_DOWN_SPRITE_PROMPT = `Create a 4-frame pixel art walk cycle sprite sheet of this character walking DOWNWARD (toward the camera) in a top-down isometric RPG perspective (3/4 overhead view, like a classic top-down RPG).

Arrange the 4 frames in a 2x2 grid on white background. The character is walking toward the viewer (south/down).

Top row (frames 1-2):
Frame 1 (top-left): Left foot forward stride, arms swinging naturally
Frame 2 (top-right): Feet together, passing/transition pose

Bottom row (frames 3-4):
Frame 3 (bottom-left): Right foot forward stride, arms swinging naturally
Frame 4 (bottom-right): Feet together, passing/transition back

We see the character's front/face. Top-down 3/4 view - we see the top of their head slightly. This creates a smooth looping walk cycle.

Use detailed 32-bit pixel art style with proper shading and highlights. Same character design in all frames.`;

const WALK_UP_SPRITE_PROMPT = `Create a 4-frame pixel art walk cycle sprite sheet of this character walking UPWARD (away from the camera) in a top-down isometric RPG perspective (3/4 overhead view, like a classic top-down RPG).

Arrange the 4 frames in a 2x2 grid on white background. The character is walking away from the viewer (north/up).

Top row (frames 1-2):
Frame 1 (top-left): Left foot forward stride, arms swinging naturally — BACK VIEW
Frame 2 (top-right): Feet together, passing/transition pose — BACK VIEW

Bottom row (frames 3-4):
Frame 3 (bottom-left): Right foot forward stride, arms swinging naturally — BACK VIEW
Frame 4 (bottom-right): Feet together, passing/transition back — BACK VIEW

CRITICAL: ALL 4 frames must show the character from EXACTLY the same angle — their BACK, facing directly away from the camera. Do NOT rotate or twist the character between frames. The ONLY difference between frames should be the leg and arm positions for the walk cycle. The character's body angle, head direction, and facing must be IDENTICAL in every frame — always showing the back of the character. A simple back view with only legs alternating.

Use detailed 32-bit pixel art style with proper shading and highlights. Same character design in all frames.`;

const WALK_SIDE_SPRITE_PROMPT = `Create a 4-frame pixel art walk cycle sprite sheet of this character WALKING TO THE RIGHT in a top-down isometric RPG perspective (3/4 overhead view, like a classic top-down RPG).

Arrange the 4 frames in a 2x2 grid on white background. The character is FACING RIGHT and WALKING RIGHT.

Top row (frames 1-2):
Frame 1 (top-left): Right leg forward, left leg back - stride position, arms swinging
Frame 2 (top-right): Legs close together, passing/crossing - transition pose

Bottom row (frames 3-4):
Frame 3 (bottom-left): Left leg forward, right leg back - opposite stride, arms swinging
Frame 4 (bottom-right): Legs close together, passing/crossing - transition back

We see the character's RIGHT-facing side profile from a top-down 3/4 overhead angle. This creates a smooth looping walk cycle.

Use detailed 32-bit pixel art style with proper shading and highlights. Same character design in all frames. Character facing RIGHT.`;

// Isometric attack prompts
const ATTACK_DOWN_SPRITE_PROMPT = `Create a 4-frame pixel art ATTACK animation sprite sheet of this character attacking DOWNWARD (toward the camera) in a top-down isometric RPG perspective (3/4 overhead view, like a classic top-down RPG).

Arrange the 4 frames in a 2x2 grid on white background. The character is facing toward the viewer (south/down) and performing an attack.

Top row (frames 1-2):
Frame 1 (top-left): Wind-up/anticipation - preparing to strike, pulling back weapon or gathering energy
Frame 2 (top-right): Attack in motion - the strike or spell being unleashed downward/toward camera

Bottom row (frames 3-4):
Frame 3 (bottom-left): Impact/peak - maximum extension of attack, full power
Frame 4 (bottom-right): Recovery - returning to ready stance

We see the character's front/face. Top-down 3/4 view. The attack should fit the character's design (sword, magic, punch, etc).

Use detailed 32-bit pixel art style with proper shading and highlights. Same character design in all frames. Make the attack visually dynamic.`;

const ATTACK_UP_SPRITE_PROMPT = `Create a 4-frame pixel art ATTACK animation sprite sheet of this character attacking UPWARD (away from the camera) in a top-down isometric RPG perspective (3/4 overhead view, like a classic top-down RPG).

I've also sent you a reference of the same character's front-facing attack. Use the EXACT SAME attack type, weapon, and visual effects - just show it from behind.

Arrange the 4 frames in a 2x2 grid on white background. The character is facing away from the viewer (north/up) and performing the same attack.

Top row (frames 1-2):
Frame 1 (top-left): Wind-up/anticipation - same motion as reference but seen from behind
Frame 2 (top-right): Attack in motion - the strike unleashed upward/away from camera

Bottom row (frames 3-4):
Frame 3 (bottom-left): Impact/peak - maximum extension, same attack type as reference
Frame 4 (bottom-right): Recovery - returning to ready stance

We see the character's back. Top-down 3/4 view. MUST use the same attack style as the reference image.

Use detailed 32-bit pixel art style with proper shading and highlights. Same character design in all frames.`;

const ATTACK_SIDE_SPRITE_PROMPT = `Create a 4-frame pixel art ATTACK animation sprite sheet of this character attacking SIDEWAYS (to the right) in a top-down isometric RPG perspective (3/4 overhead view, like a classic top-down RPG).

I've also sent you a reference of the same character's front-facing attack. Use the EXACT SAME attack type, weapon, and visual effects - just show it from the side profile.

Arrange the 4 frames in a 2x2 grid on white background. The character faces RIGHT and performs the same attack.

Top row (frames 1-2):
Frame 1 (top-left): Wind-up/anticipation - same motion as reference but from side view, facing right
Frame 2 (top-right): Attack in motion - the strike unleashed to the right

Bottom row (frames 3-4):
Frame 3 (bottom-left): Impact/peak - maximum extension, same attack type as reference
Frame 4 (bottom-right): Recovery - returning to ready stance

IMPORTANT: Show the character's SIDE PROFILE facing RIGHT. Top-down 3/4 overhead angle. MUST use the same attack style as the reference image.

Use detailed 32-bit pixel art style with proper shading and highlights. Same character design in all frames. Character facing RIGHT.`;

const IDLE_ISO_SPRITE_PROMPT = `Create a 4-frame pixel art idle/breathing animation sprite sheet of this character in a top-down isometric RPG perspective (3/4 overhead view, like a classic top-down RPG).

Arrange the 4 frames in a 2x2 grid on white background. The character is FACING TOWARD THE CAMERA (south/down) and standing still with a subtle idle animation.

Top row (frames 1-2):
Frame 1 (top-left): Neutral standing pose - relaxed stance, facing down/toward viewer
Frame 2 (top-right): Slight inhale - body rises subtly, maybe slight arm movement

Bottom row (frames 3-4):
Frame 3 (bottom-left): Full breath - slight upward posture
Frame 4 (bottom-right): Exhale - returning to neutral, slight settle

Keep movements SUBTLE - this is a gentle breathing/idle loop, not dramatic motion. Character should look alive but relaxed. We see the character's front/face from a top-down 3/4 overhead angle.

Use detailed 32-bit pixel art style with proper shading and highlights. Same character design in all frames.`;

type SpriteType = "walk" | "jump" | "attack" | "idle" | "walk-down" | "walk-up" | "walk-side" | "attack-down" | "attack-up" | "attack-side" | "idle-iso";

const PROMPTS: Record<SpriteType, string> = {
  walk: WALK_SPRITE_PROMPT,
  jump: JUMP_SPRITE_PROMPT,
  attack: ATTACK_SPRITE_PROMPT,
  idle: IDLE_SPRITE_PROMPT,
  "walk-down": WALK_DOWN_SPRITE_PROMPT,
  "walk-up": WALK_UP_SPRITE_PROMPT,
  "walk-side": WALK_SIDE_SPRITE_PROMPT,
  "attack-down": ATTACK_DOWN_SPRITE_PROMPT,
  "attack-up": ATTACK_UP_SPRITE_PROMPT,
  "attack-side": ATTACK_SIDE_SPRITE_PROMPT,
  "idle-iso": IDLE_ISO_SPRITE_PROMPT,
};

// GPT Image 2 tends to render the side-scroller walk character facing the
// wrong direction with the default prompt. Override just that sprite type
// with viewer-space language and a concrete classic-platformer reference.
const GPT_IMAGE_2_WALK_SPRITE_PROMPT = `Create a 4-frame pixel art walk cycle sprite sheet of this character.

Character orientation (critical): The character is shown in SIDE PROFILE, with their face, chest, and front foot pointing toward the RIGHT edge of the image. The character's back is on the LEFT side of the image. This is the same side-profile orientation used in classic 2D platformers like Super Mario Bros or Mega Man moving rightward across the screen.

Arrange the 4 frames in a 2x2 grid on white background.

Top row (frames 1-2):
Frame 1 (top-left): Front leg (right leg) extended forward toward the right edge of the image, back leg extended behind toward the left edge
Frame 2 (top-right): Legs close together, passing pose

Bottom row (frames 3-4):
Frame 3 (bottom-left): Opposite stride — back leg (left leg) now forward toward the right edge
Frame 4 (bottom-right): Legs close together, passing pose

Use detailed 32-bit pixel art style with proper shading and highlights. Same character design in all frames. All 4 frames must show the character from the SAME side profile angle, facing the RIGHT edge of the image.`;

const GPT_IMAGE_2_PROMPTS: Partial<Record<SpriteType, string>> = {
  walk: GPT_IMAGE_2_WALK_SPRITE_PROMPT,
};

const ASPECT_RATIOS: Record<SpriteType, AspectRatio> = {
  walk: "1:1",   // 2x2 grid
  jump: "1:1",   // 2x2 grid
  attack: "21:9", // 2x2 grid - ultra-wide for big spell effects
  idle: "1:1",   // 2x2 grid
  "walk-down": "1:1",
  "walk-up": "1:1",
  "walk-side": "1:1",
  "attack-down": "9:16",
  "attack-up": "9:16",
  "attack-side": "16:9",
  "idle-iso": "1:1",
};

export async function POST(request: NextRequest) {
  try {
    const { characterImageUrl, type = "walk", customPrompt, referenceImageUrls, imageModel, gptImageQuality } = await request.json();

    if (!characterImageUrl) {
      return NextResponse.json(
        { error: "Character image URL is required" },
        { status: 400 }
      );
    }

    const model: ImageModel = imageModel === "gpt-image-2" ? "gpt-image-2" : "nano-banana-pro";
    const quality: GptImageQuality | undefined =
      gptImageQuality === "low" || gptImageQuality === "medium" || gptImageQuality === "high"
        ? gptImageQuality
        : undefined;
    const spriteType = (type as SpriteType) || "walk";
    const modelSpecificPrompt = model === "gpt-image-2" ? GPT_IMAGE_2_PROMPTS[spriteType] : undefined;
    const prompt = customPrompt || modelSpecificPrompt || PROMPTS[spriteType] || PROMPTS.walk;
    const aspectRatio = ASPECT_RATIOS[spriteType] || ASPECT_RATIOS.walk;

    // Build image_urls: character image + any reference images (e.g. attack-down for consistency)
    const imageUrls = [characterImageUrl, ...(referenceImageUrls || [])];

    const image = await generateImage({
      model,
      prompt,
      imageUrls,
      aspectRatio,
      gptImageQuality: quality,
    });

    return NextResponse.json({
      imageUrl: image.url,
      width: image.width,
      height: image.height,
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
