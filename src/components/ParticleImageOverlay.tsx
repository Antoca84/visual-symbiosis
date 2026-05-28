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

    // ── Luma / color / gradient maps ─────────────────────────────────────────
    let lumaMap: Float32Array | null = null;
    let gradX: Float32Array | null = null;
    let gradY: Float32Array | null = null;
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

    // Returns image gradient at normalised position (Sobel, clamped to interior)
    const sampleGrad = (nx: number, ny: number): [number, number] => {
      if (!gradX || !gradY) return [0, 0];
      const ix = Math.min(mapW - 2, Math.max(1, Math.floor(nx * mapW)));
      const iy = Math.min(mapH - 2, Math.max(1, Math.floor(ny * mapH)));
      return [gradX[iy * mapW + ix], gradY[iy * mapW + ix]];
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
      // Build gradient field (Sobel) for line-following physics
      gradX = new Float32Array(mapW * mapH);
      gradY = new Float32Array(mapW * mapH);
      for (let iy = 1; iy < mapH - 1; iy++) {
        for (let ix = 1; ix < mapW - 1; ix++) {
          gradX[iy * mapW + ix] = lumaMap[iy * mapW + (ix + 1)] - lumaMap[iy * mapW + (ix - 1)];
          gradY[iy * mapW + ix] = lumaMap[(iy + 1) * mapW + ix] - lumaMap[(iy - 1) * mapW + ix];
        }
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
    const MOB = window.innerWidth < 768;
    const COUNT = MOB ? 80 : 520;

    const spawn = (): Particle => {
      // Spawn in inner 60% of canvas — physics drives particles outward from center
      let nx = 0.5, ny = 0.5, luma = 0.5;
      for (let k = 0; k < 12; k++) {
        const tx = Math.max(0, Math.min(1, 0.5 + (Math.random() - 0.5) * 0.60));
        const ty = Math.max(0, Math.min(1, 0.5 + (Math.random() - 0.5) * 0.60));
        const tl = sampleLuma(tx, ty);
        if (Math.random() < tl * 1.8) { nx = tx; ny = ty; luma = tl; break; }
        if (k === 11) { nx = tx; ny = ty; luma = sampleLuma(nx, ny); }
      }
      const [sr, sg, sb] = sampleColor(nx, ny);
      const maxLife = 90 + Math.random() * 120;
      // Initial kick aligned with gradient tangent + outward direction
      const [gx, gy] = sampleGrad(nx, ny);
      const gLen = Math.sqrt(gx * gx + gy * gy) + 0.001;
      let tgx = -gy / gLen, tgy = gx / gLen;
      const cx = nx - 0.5, cy = ny - 0.5;
      const cLen = Math.sqrt(cx * cx + cy * cy) + 0.01;
      if (tgx * (cx / cLen) + tgy * (cy / cLen) < 0) { tgx = -tgx; tgy = -tgy; }
      const kickSpeed = MOB ? 0.03 + Math.random() * 0.04 : 0.05 + Math.random() * 0.08;
      return {
        x: nx * W, y: ny * H,
        vx: tgx * kickSpeed,
        vy: tgy * kickSpeed,
        life: Math.random() * maxLife * 0.5,
        maxLife,
        size: 0.4 + luma * (MOB ? 1.0 : 1.8),
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
      t += MOB ? 0.0012 : 0.005;

      // Fade trails to black
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 0.055;
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;

      ctx.globalCompositeOperation = "lighter";

      for (const p of particles) {
        p.life++;

        // Sample image structure at current position
        const pnx = p.x / W, pny = p.y / H;
        const localLuma = sampleLuma(pnx, pny);

        // Gradient tangent → direction of the nearest image line
        const [gx, gy] = sampleGrad(pnx, pny);
        const gLen = Math.sqrt(gx * gx + gy * gy) + 0.001;
        let tgx = -gy / gLen, tgy = gx / gLen; // tangent = ⊥ to gradient

        // Centrifugal direction (outward from canvas centre)
        const cx = pnx - 0.5, cy = pny - 0.5;
        const cLen = Math.sqrt(cx * cx + cy * cy) + 0.01;
        const cfx = cx / cLen, cfy = cy / cLen;

        // Orient tangent so it points outward (not inward)
        if (tgx * cfx + tgy * cfy < 0) { tgx = -tgx; tgy = -tgy; }

        // Force blend: 70% tangent (scaled by luma = thick lines pull harder),
        //              25% centrifugal, 5% organic noise
        const baseForce = MOB ? 0.0016 : 0.0030;
        const tangentStr = localLuma * 0.70;
        const centStr    = 0.25;
        const noiseStr   = 0.06;
        p.vx += (tgx * tangentStr + cfx * centStr + (noise(p.x * 0.006, p.y * 0.006, t) - 0.5) * noiseStr) * baseForce;
        p.vy += (tgy * tangentStr + cfy * centStr + (noise(p.x * 0.006 + 80, p.y * 0.006 + 80, t) - 0.5) * noiseStr) * baseForce;

        // Particle size tracks local line thickness dynamically
        p.size = 0.35 + localLuma * (MOB ? 1.0 : 1.8);

        const damp = MOB ? 0.91 : 0.95;
        p.vx *= damp; p.vy *= damp;
        p.x += p.vx; p.y += p.vy;

        if (p.life >= p.maxLife || p.x < -8 || p.x > W + 8 || p.y < -8 || p.y > H + 8) {
          Object.assign(p, spawn()); continue;
        }

        const lr = p.life / p.maxLife;
        const alpha = lr < 0.15 ? lr / 0.15 : lr > 0.72 ? (1 - lr) / 0.28 : 1;
        if (alpha < 0.01) continue;

        // Core dot
        ctx.globalAlpha = alpha * 0.72;
        ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();

        // Glow halo: mobile halved again (0.022 vs 0.10), larger particles get less halo
        const sizeNorm = Math.min(1, p.size / 2.15);
        ctx.globalAlpha = alpha * (MOB ? 0.022 : 0.10) * (1 - sizeNorm * 0.25);
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 5.0, 0, Math.PI * 2); ctx.fill();
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
