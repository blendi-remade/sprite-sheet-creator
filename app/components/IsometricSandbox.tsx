"use client";

import { useEffect, useRef, useCallback } from "react";

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Frame {
  dataUrl: string;
  width: number;
  height: number;
  contentBounds: BoundingBox;
}

export interface IsometricScales {
  walkDown: number;
  walkUp: number;
  walkSide: number;
  attackDown: number;
  attackUp: number;
  attackSide: number;
  idle: number;
}

export const DEFAULT_ISOMETRIC_SCALES: IsometricScales = {
  walkDown: 1,
  walkUp: 1,
  walkSide: 1,
  attackDown: 1,
  attackUp: 1,
  attackSide: 1.45,
  idle: 1,
};

interface IsometricSandboxProps {
  walkDownFrames: Frame[];
  walkUpFrames: Frame[];
  walkLeftFrames: Frame[];
  walkRightFrames: Frame[];
  attackDownFrames: Frame[];
  attackUpFrames: Frame[];
  attackSideFrames: Frame[];
  idleFrames: Frame[];
  fps: number;
  mapUrl?: string | null;
  spriteScales?: IsometricScales;
  mapScale?: number;
}

type Direction = "down" | "up" | "left" | "right";

export default function IsometricSandbox({
  walkDownFrames,
  walkUpFrames,
  walkLeftFrames,
  walkRightFrames,
  attackDownFrames,
  attackUpFrames,
  attackSideFrames,
  idleFrames,
  fps,
  mapUrl,
  spriteScales,
  mapScale = 1,
}: IsometricSandboxProps) {
  const scales = spriteScales ?? DEFAULT_ISOMETRIC_SCALES;
  const scalesRef = useRef(scales);
  scalesRef.current = scales;
  const mapScaleRef = useRef(mapScale);
  mapScaleRef.current = mapScale;
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const characterState = useRef({
    worldX: 0,
    worldY: 0,
    direction: "down" as Direction,
    isWalking: false,
    isAttacking: false,
    walkFrameIndex: 0,
    walkFrameTime: 0,
    attackFrameIndex: 0,
    attackFrameTime: 0,
    idleFrameIndex: 0,
    idleFrameTime: 0,
  });
  const keysPressed = useRef<Set<string>>(new Set());
  const animationRef = useRef<number>(0);

  // Walk sprite images for each direction
  const walkDownImagesRef = useRef<HTMLImageElement[]>([]);
  const walkUpImagesRef = useRef<HTMLImageElement[]>([]);
  const walkLeftImagesRef = useRef<HTMLImageElement[]>([]);
  const walkDownFrameDataRef = useRef<Frame[]>([]);
  const walkUpFrameDataRef = useRef<Frame[]>([]);
  const walkLeftFrameDataRef = useRef<Frame[]>([]);

  // Attack sprite images for each direction
  const atkDownImagesRef = useRef<HTMLImageElement[]>([]);
  const atkUpImagesRef = useRef<HTMLImageElement[]>([]);
  const atkSideImagesRef = useRef<HTMLImageElement[]>([]);
  const atkDownFrameDataRef = useRef<Frame[]>([]);
  const atkUpFrameDataRef = useRef<Frame[]>([]);
  const atkSideFrameDataRef = useRef<Frame[]>([]);

  // Idle sprite images
  const idleImagesRef = useRef<HTMLImageElement[]>([]);
  const idleFrameDataRef = useRef<Frame[]>([]);

  // Map image
  const mapImageRef = useRef<HTMLImageElement | null>(null);
  const mapLoadedRef = useRef(false);

  const lastTimeRef = useRef(performance.now());
  const fpsRef = useRef(fps);
  fpsRef.current = fps;

  const VIEWPORT_WIDTH = 800;
  const VIEWPORT_HEIGHT = 600;
  const MOVE_SPEED = 3;

  // Load sprite frames helper
  const loadFrames = useCallback(
    async (
      frames: Frame[],
      imagesRef: React.MutableRefObject<HTMLImageElement[]>,
      dataRef: React.MutableRefObject<Frame[]>
    ) => {
      const images: HTMLImageElement[] = [];
      for (const frame of frames) {
        const img = new Image();
        img.src = frame.dataUrl;
        await new Promise((resolve) => {
          img.onload = resolve;
        });
        images.push(img);
      }
      imagesRef.current = images;
      dataRef.current = frames;
    },
    []
  );

  // Load walk sprites
  useEffect(() => {
    if (walkDownFrames.length > 0) loadFrames(walkDownFrames, walkDownImagesRef, walkDownFrameDataRef);
  }, [walkDownFrames, loadFrames]);
  useEffect(() => {
    if (walkUpFrames.length > 0) loadFrames(walkUpFrames, walkUpImagesRef, walkUpFrameDataRef);
  }, [walkUpFrames, loadFrames]);
  useEffect(() => {
    if (walkLeftFrames.length > 0) loadFrames(walkLeftFrames, walkLeftImagesRef, walkLeftFrameDataRef);
  }, [walkLeftFrames, loadFrames]);
  // walkRightFrames use the same images as walkLeftFrames, flipped during drawing

  // Load attack sprites
  useEffect(() => {
    if (attackDownFrames.length > 0) loadFrames(attackDownFrames, atkDownImagesRef, atkDownFrameDataRef);
  }, [attackDownFrames, loadFrames]);
  useEffect(() => {
    if (attackUpFrames.length > 0) loadFrames(attackUpFrames, atkUpImagesRef, atkUpFrameDataRef);
  }, [attackUpFrames, loadFrames]);
  useEffect(() => {
    if (attackSideFrames.length > 0) loadFrames(attackSideFrames, atkSideImagesRef, atkSideFrameDataRef);
  }, [attackSideFrames, loadFrames]);

  // Load idle sprites
  useEffect(() => {
    if (idleFrames.length > 0) loadFrames(idleFrames, idleImagesRef, idleFrameDataRef);
  }, [idleFrames, loadFrames]);

  // Load map image
  useEffect(() => {
    if (!mapUrl) {
      mapLoadedRef.current = false;
      mapImageRef.current = null;
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      mapImageRef.current = img;
      mapLoadedRef.current = true;
      characterState.current.worldX = img.naturalWidth / 2;
      characterState.current.worldY = img.naturalHeight / 2;
    };
    img.onerror = () => console.log("Map image failed to load");
    img.src = mapUrl;
  }, [mapUrl]);

  // Get walk images and frame data for a direction
  // Side sprites are generated facing RIGHT — "left" reuses them and is flipped during drawing
  const getWalkAssets = useCallback((dir: Direction) => {
    switch (dir) {
      case "down": return { images: walkDownImagesRef.current, frameData: walkDownFrameDataRef.current };
      case "up": return { images: walkUpImagesRef.current, frameData: walkUpFrameDataRef.current };
      case "right": return { images: walkLeftImagesRef.current, frameData: walkLeftFrameDataRef.current };
      case "left": return { images: walkLeftImagesRef.current, frameData: walkLeftFrameDataRef.current }; // flipped
    }
  }, []);

  // Get attack images and frame data for a direction
  // Side sprites are generated facing RIGHT — "left" reuses them and is flipped during drawing
  const getAttackAssets = useCallback((dir: Direction) => {
    switch (dir) {
      case "down": return { images: atkDownImagesRef.current, frameData: atkDownFrameDataRef.current };
      case "up": return { images: atkUpImagesRef.current, frameData: atkUpFrameDataRef.current };
      case "right": return { images: atkSideImagesRef.current, frameData: atkSideFrameDataRef.current };
      case "left": return { images: atkSideImagesRef.current, frameData: atkSideFrameDataRef.current }; // flipped
    }
  }, []);

  // Main game loop
  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;

    const currentTime = performance.now();
    const deltaTime = (currentTime - lastTimeRef.current) / 1000;
    lastTimeRef.current = currentTime;

    const state = characterState.current;

    ctx.clearRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

    // Movement (disabled during attack)
    const movingUp = keysPressed.current.has("up");
    const movingDown = keysPressed.current.has("down");
    const movingLeft = keysPressed.current.has("left");
    const movingRight = keysPressed.current.has("right");
    const isMoving = !state.isAttacking && (movingUp || movingDown || movingLeft || movingRight);

    let dx = 0;
    let dy = 0;
    if (!state.isAttacking) {
      if (movingRight) dx += 1;
      if (movingLeft) dx -= 1;
      if (movingDown) dy += 1;
      if (movingUp) dy -= 1;
    }

    if (dx !== 0 && dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len;
      dy /= len;
    }

    const moveAmount = MOVE_SPEED * deltaTime * 60;
    state.worldX += dx * moveAmount;
    state.worldY += dy * moveAmount;

    if (isMoving) {
      if (Math.abs(dx) > Math.abs(dy)) {
        state.direction = dx > 0 ? "right" : "left";
      } else if (Math.abs(dy) > Math.abs(dx)) {
        state.direction = dy > 0 ? "down" : "up";
      }
    }

    state.isWalking = isMoving;

    // Map bounds (world coordinates live in scaled-pixel space so the
    // character's reachable area grows/shrinks with the map)
    const mapImg = mapImageRef.current;
    const currentMapScale = mapScaleRef.current;
    const mapW = (mapImg?.naturalWidth || VIEWPORT_WIDTH) * currentMapScale;
    const mapH = (mapImg?.naturalHeight || VIEWPORT_HEIGHT) * currentMapScale;
    state.worldX = Math.max(20, Math.min(mapW - 20, state.worldX));
    state.worldY = Math.max(20, Math.min(mapH - 20, state.worldY));

    // Camera follows character, centered on viewport
    let cameraX = state.worldX - VIEWPORT_WIDTH / 2;
    let cameraY = state.worldY - VIEWPORT_HEIGHT / 2;
    cameraX = Math.max(0, Math.min(mapW - VIEWPORT_WIDTH, cameraX));
    cameraY = Math.max(0, Math.min(mapH - VIEWPORT_HEIGHT, cameraY));
    if (mapW < VIEWPORT_WIDTH) cameraX = -(VIEWPORT_WIDTH - mapW) / 2;
    if (mapH < VIEWPORT_HEIGHT) cameraY = -(VIEWPORT_HEIGHT - mapH) / 2;

    // Draw map at scaled resolution
    if (mapLoadedRef.current && mapImg) {
      ctx.drawImage(mapImg, -cameraX, -cameraY, mapW, mapH);
    } else {
      ctx.fillStyle = "#2d5a27";
      ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 1;
      const gridSize = 32;
      for (let x = (-cameraX % gridSize); x < VIEWPORT_WIDTH; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, VIEWPORT_HEIGHT); ctx.stroke();
      }
      for (let y = (-cameraY % gridSize); y < VIEWPORT_HEIGHT; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VIEWPORT_WIDTH, y); ctx.stroke();
      }
      ctx.fillStyle = "#ffffff";
      ctx.font = "16px Arial";
      ctx.textAlign = "center";
      ctx.fillText(mapUrl ? "Loading map..." : "Generate a map to explore!", VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2);
    }

    const currentFps = fpsRef.current;

    // Walk animation
    if (state.isWalking && !state.isAttacking) {
      state.walkFrameTime += deltaTime;
      const frameDuration = 1 / currentFps;
      if (state.walkFrameTime >= frameDuration) {
        state.walkFrameTime -= frameDuration;
        const { images } = getWalkAssets(state.direction);
        if (images.length > 0) {
          state.walkFrameIndex = (state.walkFrameIndex + 1) % images.length;
        }
      }
    } else if (!state.isAttacking) {
      state.walkFrameIndex = 0;
      state.walkFrameTime = 0;
    }

    // Attack animation — plays once then stops
    if (state.isAttacking) {
      state.attackFrameTime += deltaTime;
      const attackFrameDuration = 1 / (currentFps * 1.2);
      if (state.attackFrameTime >= attackFrameDuration) {
        state.attackFrameTime -= attackFrameDuration;
        state.attackFrameIndex++;
        const { images } = getAttackAssets(state.direction);
        if (state.attackFrameIndex >= images.length) {
          state.isAttacking = false;
          state.attackFrameIndex = 0;
          state.attackFrameTime = 0;
        }
      }
    }

    // Idle animation — plays when standing still
    const idleImages = idleImagesRef.current;
    if (!state.isWalking && !state.isAttacking && idleImages.length > 0) {
      state.idleFrameTime += deltaTime;
      const idleFrameDuration = 1 / (currentFps * 0.5); // Slower for subtle breathing
      if (state.idleFrameTime >= idleFrameDuration) {
        state.idleFrameTime -= idleFrameDuration;
        state.idleFrameIndex = (state.idleFrameIndex + 1) % idleImages.length;
      }
    }

    // Determine which sprite to draw (attack > walk > idle)
    let currentImg: HTMLImageElement | null = null;
    let currentFrame: Frame | null = null;
    const needsFlip = state.direction === "left";

    if (state.isAttacking) {
      const { images, frameData } = getAttackAssets(state.direction);
      if (images.length > 0) {
        const idx = Math.min(state.attackFrameIndex, images.length - 1);
        currentImg = images[idx];
        currentFrame = frameData[idx] || null;
      }
    } else if (state.isWalking) {
      const { images, frameData } = getWalkAssets(state.direction);
      if (images.length > 0) {
        const idx = state.walkFrameIndex % images.length;
        currentImg = images[idx];
        currentFrame = frameData[idx] || null;
      }
    } else if (idleImages.length > 0) {
      // Idle animation
      const idleFrameData = idleFrameDataRef.current;
      const idx = state.idleFrameIndex % idleImages.length;
      currentImg = idleImages[idx];
      currentFrame = idleFrameData[idx] || null;
    } else {
      // Fallback: static walk-down frame 0
      const { images, frameData } = getWalkAssets("down");
      if (images.length > 0) {
        currentImg = images[0];
        currentFrame = frameData[0] || null;
      }
    }

    // Draw character
    if (currentImg && currentFrame) {
      const targetContentHeight = 84; // ~1.5x original size
      const referenceData = walkDownFrameDataRef.current.length > 0 ? walkDownFrameDataRef.current[0] : currentFrame;
      const referenceContentHeight = referenceData.contentBounds.height;
      const baseScale = targetContentHeight / referenceContentHeight;

      // Per-sprite scale multiplier (user-adjustable in the sandbox UI)
      const isSide = state.direction === "left" || state.direction === "right";
      let multiplier: number;
      if (state.isAttacking) {
        multiplier = isSide
          ? scalesRef.current.attackSide
          : state.direction === "up"
          ? scalesRef.current.attackUp
          : scalesRef.current.attackDown;
      } else if (state.isWalking) {
        multiplier = isSide
          ? scalesRef.current.walkSide
          : state.direction === "up"
          ? scalesRef.current.walkUp
          : scalesRef.current.walkDown;
      } else {
        multiplier = scalesRef.current.idle;
      }
      const scale = baseScale * multiplier;

      const drawWidth = currentImg.width * scale;
      const drawHeight = currentImg.height * scale;

      const screenX = state.worldX - cameraX;
      const screenY = state.worldY - cameraY;

      const contentBounds = currentFrame.contentBounds;
      const contentCenterX = (contentBounds.x + contentBounds.width / 2) * scale;
      const contentCenterY = (contentBounds.y + contentBounds.height / 2) * scale;
      const drawX = screenX - contentCenterX;
      const drawY = screenY - contentCenterY;

      // Shadow
      ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      ctx.beginPath();
      ctx.ellipse(screenX, screenY + (contentBounds.height * scale) / 2 - 2, (contentBounds.width * scale) / 3, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Draw sprite — flip horizontally for "right" direction
      ctx.save();
      if (needsFlip) {
        ctx.translate(screenX * 2, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(currentImg, screenX - contentCenterX, drawY, drawWidth, drawHeight);
      } else {
        ctx.drawImage(currentImg, drawX, drawY, drawWidth, drawHeight);
      }
      ctx.restore();
    }

    // Vignette
    const vignette = ctx.createRadialGradient(VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2, VIEWPORT_HEIGHT * 0.5, VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2, VIEWPORT_HEIGHT);
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(1, "rgba(0, 0, 0, 0.3)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

    animationRef.current = requestAnimationFrame(gameLoop);
  }, [getWalkAssets, getAttackAssets, mapUrl]);

  // Initialize
  useEffect(() => {
    if (!containerRef.current || walkDownFrames.length === 0) return;

    containerRef.current.innerHTML = "";
    const canvas = document.createElement("canvas");
    canvas.width = VIEWPORT_WIDTH;
    canvas.height = VIEWPORT_HEIGHT;
    canvas.style.display = "block";
    canvas.style.borderRadius = "8px";
    containerRef.current.appendChild(canvas);
    canvasRef.current = canvas;

    const mapImg = mapImageRef.current;
    const initialMapScale = mapScaleRef.current;
    characterState.current.worldX = mapImg ? (mapImg.naturalWidth * initialMapScale) / 2 : VIEWPORT_WIDTH / 2;
    characterState.current.worldY = mapImg ? (mapImg.naturalHeight * initialMapScale) / 2 : VIEWPORT_HEIGHT / 2;
    characterState.current.direction = "down";
    characterState.current.walkFrameIndex = 0;
    characterState.current.walkFrameTime = 0;
    characterState.current.isAttacking = false;
    characterState.current.attackFrameIndex = 0;
    characterState.current.attackFrameTime = 0;
    lastTimeRef.current = performance.now();

    animationRef.current = requestAnimationFrame(gameLoop);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") keysPressed.current.add("right");
      if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") keysPressed.current.add("left");
      if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") keysPressed.current.add("up");
      if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") keysPressed.current.add("down");
      // Attack on J
      if ((e.key === "j" || e.key === "J") && !characterState.current.isAttacking) {
        characterState.current.isAttacking = true;
        characterState.current.attackFrameIndex = 0;
        characterState.current.attackFrameTime = 0;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") keysPressed.current.delete("right");
      if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") keysPressed.current.delete("left");
      if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") keysPressed.current.delete("up");
      if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") keysPressed.current.delete("down");
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      cancelAnimationFrame(animationRef.current);
    };
  }, [walkDownFrames, gameLoop]);

  return (
    <div className="pixi-sandbox-container">
      <div ref={containerRef} className="pixi-canvas-wrapper" />
    </div>
  );
}
