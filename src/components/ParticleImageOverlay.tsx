import { useEffect, useRef } from "react";

const LUMA_RES = 128;

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number;
  r: number; g: number; b: number;
}

interface Props { imageSrc: string; }

export function ParticleImageOverlay({ imageSrc }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef   = useRef<number>(0);

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
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, W, H);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // ── Luma / color maps ────────────────────────────────────────────────────
    let lumaMap: Float32Array | null = null;
    let colR: Uint8ClampedArray | null = null;
    let colG: Uint8ClampedArray | null = null;
    let colB: Uint8ClampedArray | null = null;
    let mapW = 0, mapH = 0;

    const sampleLuma = (nx: number, ny: number) => {
      if (!lumaMap) return 0.5;
      const ix = Math.min(mapW - 1, Math.floor(nx * mapW));
      const iy = Math.min(mapH - 1, Math.floor(ny * mapH));
      return lumaMap[iy * mapW + ix];
    };

    const sampleColor = (nx: number, ny: number): [number, number, number] => {
      if (!colR) return [160, 190, 220];
      const ix = Math.min(mapW - 1, Math.floor(nx * mapW));
      const iy = Math.min(mapH - 1, Math.floor(ny * mapH));
      const i  = iy * mapW + ix;
      return [colR[i], colG![i], colB![i]];
    };

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      mapW = LUMA_RES;
      mapH = Math.round(LUMA_RES * img.height / img.width);
      const tc = document.createElement("canvas");
      tc.width = mapW; tc.height = mapH;
      const tCtx = tc.getContext("2d")!;
      tCtx.drawImage(img, 0, 0, mapW, mapH);
      const d = tCtx.getImageData(0, 0, mapW, mapH).data;
      lumaMap = new Float32Array(mapW * mapH);
      colR = new Uint8ClampedArray(mapW * mapH);
      colG = new Uint8ClampedArray(mapW * mapH);
      colB = new Uint8ClampedArray(mapW * mapH);
      for (let i = 0; i < mapW * mapH; i++) {
        const r = d[i*4], g = d[i*4+1], b = d[i*4+2];
        lumaMap[i] = (0.299*r + 0.587*g + 0.114*b) / 255;
        colR[i] = r; colG[i] = g; colB[i] = b;
      }
      // Redistribute particles to luminance-weighted positions
      for (const p of particles) Object.assign(p, spawn());
    };
    img.src = imageSrc;

    // ── Noise ────────────────────────────────────────────────────────────────
    const hash = (n: number) => { const x = Math.sin(n) * 43758.5453; return x - Math.floor(x); };
    const noise = (x: number, y: number, t: number) =>
      hash(x * 127.1 + y * 311.7 + t * 74.3);

    // ── Spawn ────────────────────────────────────────────────────────────────
    const COUNT = window.innerWidth < 768 ? 220 : 520;

    const spawn = (): Particle => {
      let nx = Math.random(), ny = Math.random(), luma = 0.5;
      for (let k = 0; k < 10; k++) {
        const tx = Math.random(), ty = Math.random();
        const tl = sampleLuma(tx, ty);
        if (Math.random() < tl * tl * 1.6) { nx = tx; ny = ty; luma = tl; break; }
        if (k === 9) { nx = tx; ny = ty; luma = sampleLuma(tx, ty); }
      }
      const [sr, sg, sb] = sampleColor(nx, ny);
      const maxLife = 80 + Math.random() * 100;
      return {
        x: nx * W, y: ny * H,
        vx: (Math.random() - 0.5) * 0.35,
        vy: -(0.12 + Math.random() * 0.32),
        life: Math.random() * maxLife * 0.6,
        maxLife,
        size: 0.5 + luma * 1.6,
        r: Math.min(255, Math.round(sr * 1.3 + 25)),
        g: Math.min(255, Math.round(sg * 1.2 + 25)),
        b: Math.min(255, Math.round(sb * 1.1 + 55)),
      };
    };

    const particles: Particle[] = Array.from({ length: COUNT }, spawn);

    // ── Draw loop ────────────────────────────────────────────────────────────
    let t = 0;
    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      t += 0.005;

      // Fade trails to black
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 0.055;
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;

      ctx.globalCompositeOperation = "lighter";

      for (const p of particles) {
        p.life++;
        p.vx += (noise(p.x * 0.007, p.y * 0.007, t) - 0.5) * 0.028;
        p.vy += (noise(p.x * 0.007 + 80, p.y * 0.007 + 80, t) - 0.5) * 0.012;
        p.vx *= 0.96; p.vy *= 0.97;
        p.x += p.vx; p.y += p.vy;

        if (p.life >= p.maxLife || p.x < -8 || p.x > W + 8 || p.y < -8 || p.y > H + 8) {
          Object.assign(p, spawn()); continue;
        }

        const lr = p.life / p.maxLife;
        const alpha = lr < 0.15 ? lr / 0.15 : lr > 0.72 ? (1 - lr) / 0.28 : 1;
        if (alpha < 0.01) continue;

        // Core
        ctx.globalAlpha = alpha * 0.72;
        ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();

        // Soft glow halo
        ctx.globalAlpha = alpha * 0.10;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 5.5, 0, Math.PI * 2); ctx.fill();
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, [imageSrc]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ mixBlendMode: "screen" }}
    />
  );
}
