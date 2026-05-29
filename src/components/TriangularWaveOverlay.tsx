import { useEffect, useRef } from "react";

interface Props { imageSrc: string; }

const PROC = 512;
const AMP  = 0.18; // brightness swing ±18%

// Value noise — no periodic banding
const hash = (n: number) => { const x = Math.sin(n) * 43758.5453; return x - Math.floor(x); };
const vnoise = (x: number, y: number) => {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix     + iy     * 57.0);
  const b = hash(ix + 1 + iy     * 57.0);
  const c = hash(ix     + (iy+1) * 57.0);
  const d = hash(ix + 1 + (iy+1) * 57.0);
  return a + (b-a)*ux + (c-a)*uy + (d-b)*ux*uy - (c-a)*ux*uy;
};

// 2-octave FBM — organic variation, no visible frequency
const fbm = (x: number, y: number) =>
  vnoise(x, y) * 0.65 + vnoise(x * 2.1, y * 2.1) * 0.35;

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

    // Noise scale: ~5 cells across image → each cell larger than individual triangles
    const SCALE = 5.0;
    // Drift speed — slow enough to feel organic, fast enough to notice
    const SPD_X = 0.08;
    const SPD_Y = 0.14;

    let t = 0;

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      t += 0.016;

      if (!ready) return;

      const tx = t * SPD_X;
      const ty = t * SPD_Y;

      for (let py = 0; py < PROC; py++) {
        const ny = py / PROC;
        for (let px = 0; px < PROC; px++) {
          const nx = px / PROC;
          const n   = fbm(nx * SCALE + tx, ny * SCALE + ty); // 0..1
          const mod = 1 + (n - 0.5) * 2 * AMP;              // 0.82..1.18
          const i   = py * PROC + px;
          const idx = i * 4;
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
