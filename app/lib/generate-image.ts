import { fal } from "@fal-ai/client";

export type ImageModel = "nano-banana-pro" | "gpt-image-2";

export type AspectRatio = "1:1" | "21:9" | "9:16" | "16:9";

export type GptImageQuality = "low" | "medium" | "high";

interface GenerateImageInput {
  model: ImageModel;
  prompt: string;
  imageUrls?: string[];
  aspectRatio: AspectRatio;
  /** Only applied when model === "gpt-image-2". Defaults to "high". */
  gptImageQuality?: GptImageQuality;
}

interface GeneratedImage {
  url: string;
  width: number;
  height: number;
}

export async function generateImage({
  model,
  prompt,
  imageUrls,
  aspectRatio,
  gptImageQuality,
}: GenerateImageInput): Promise<GeneratedImage> {
  const isEdit = Array.isArray(imageUrls) && imageUrls.length > 0;

  if (model === "gpt-image-2") {
    const endpoint = isEdit ? "openai/gpt-image-2/edit" : "openai/gpt-image-2";
    const input: Record<string, unknown> = {
      prompt,
      image_size: aspectRatioToImageSize(aspectRatio),
      quality: gptImageQuality ?? "high",
      num_images: 1,
      output_format: "png",
    };
    if (isEdit) input.image_urls = imageUrls;

    const result = await fal.subscribe(endpoint, { input });
    const data = result.data as {
      images: Array<{ url: string; width: number; height: number }>;
    };
    if (!data.images?.length) throw new Error("No image generated");
    return data.images[0];
  }

  // nano-banana-pro (default)
  const endpoint = isEdit
    ? "fal-ai/nano-banana-pro/edit"
    : "fal-ai/nano-banana-pro";
  const input: Record<string, unknown> = {
    prompt,
    num_images: 1,
    aspect_ratio: aspectRatio,
    output_format: "png",
    resolution: "1K",
  };
  if (isEdit) input.image_urls = imageUrls;

  const result = await fal.subscribe(endpoint, { input });
  const data = result.data as {
    images: Array<{ url: string; width: number; height: number }>;
  };
  if (!data.images?.length) throw new Error("No image generated");
  return data.images[0];
}

function aspectRatioToImageSize(
  ar: AspectRatio
): string | { width: number; height: number } {
  switch (ar) {
    case "1:1":
      return "square_hd";
    case "9:16":
      return "portrait_16_9";
    case "16:9":
      return "landscape_16_9";
    case "21:9":
      // Not a gpt-image-2 preset — build a custom size.
      // Constraints: both dims multiple of 16, max edge 3840, aspect <= 3:1,
      // total pixels between 655,360 and 8,294,400. 2688x1152 ≈ 21:9.
      return { width: 2688, height: 1152 };
  }
}
