import { useEffect, useRef } from "react";

interface Props { imageSrc: string; }

const PROC = 512;
const FREQ = 3.5;  // vertical wave cycles
const SPD  = 1.4;  // top-to-bottom speed
const AMP  = 0.20; // brightness swing ±20%

export function TriangularWaveOverlay({ imageSrc }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext("2d")!;
    let W = 0, H = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.offsetWidth;
      H = canvas.offsetHeight;
      canvas.width  = W * dpr;
      canvas.height = H * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Pre-bake image pixel data at processing resolution
    const srcR = new Uint8Array(PROC * PROC);
    const srcG = new Uint8Array(PROC * PROC);
    const srcB = new Uint8Array(PROC * PROC);
    let ready = false;

    const procCanvas = document.createElement("canvas");
    procCanvas.width = PROC; procCanvas.height = PROC;
    const procCtx = procCanvas.getContext("2d")!;
    const outData = procCtx.createImageData(PROC, PROC);
    const outD    = outData.data;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      procCtx.drawImage(img, 0, 0, PROC, PROC);
      const raw = procCtx.getImageData(0, 0, PROC, PROC).data;
      for (let i = 0; i < PROC * PROC; i++) {
        srcR[i] = raw[i*4];
        srcG[i] = raw[i*4+1];
        srcB[i] = raw[i*4+2];
      }
      ready = true;
    };
    img.src = imageSrc;

    let t = 0;

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      t += 0.016;

      if (!ready) return;

      for (let py = 0; py < PROC; py++) {
        const ny   = py / PROC;
        // Slight diagonal tilt (10% horizontal component)
        for (let px = 0; px < PROC; px++) {
          const nx   = px / PROC;
          const wave = Math.sin((ny + nx * 0.1) * Math.PI * FREQ - t * SPD);
          const mod  = 1 + wave * AMP; // 0.80 .. 1.20
          const i    = py * PROC + px;
          const idx  = i * 4;
          outD[idx]   = Math.min(255, Math.max(0, srcR[i] * mod));
          outD[idx+1] = Math.min(255, Math.max(0, srcG[i] * mod));
          outD[idx+2] = Math.min(255, Math.max(0, srcB[i] * mod));
          outD[idx+3] = 255;
        }
      }

      procCtx.putImageData(outData, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(procCanvas, 0, 0, W, H);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, [imageSrc]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
}
