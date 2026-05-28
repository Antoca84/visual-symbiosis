import { useEffect, useRef } from "react";

interface Props { imageSrc: string; }

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

    // Two dominant colors split at luma median
    let col1: [number, number, number] = [18, 18, 28];
    let col2: [number, number, number] = [185, 195, 215];

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const RES = 64;
      const tc = document.createElement("canvas");
      tc.width = RES; tc.height = RES;
      const tCtx = tc.getContext("2d")!;
      tCtx.drawImage(img, 0, 0, RES, RES);
      const data = tCtx.getImageData(0, 0, RES, RES).data;

      const lumas: number[] = [];
      for (let i = 0; i < RES * RES; i++)
        lumas.push(0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]);
      lumas.sort((a, b) => a - b);
      const median = lumas[Math.floor(lumas.length / 2)];

      let r1=0,g1=0,b1=0,c1=0, r2=0,g2=0,b2=0,c2=0;
      for (let i = 0; i < RES * RES; i++) {
        const l = 0.299*data[i*4] + 0.587*data[i*4+1] + 0.114*data[i*4+2];
        if (l < median) { r1+=data[i*4]; g1+=data[i*4+1]; b1+=data[i*4+2]; c1++; }
        else            { r2+=data[i*4]; g2+=data[i*4+1]; b2+=data[i*4+2]; c2++; }
      }
      if (c1 > 0) col1 = [Math.round(r1/c1), Math.round(g1/c1), Math.round(b1/c1)];
      if (c2 > 0) col2 = [Math.round(r2/c2), Math.round(g2/c2), Math.round(b2/c2)];
    };
    img.src = imageSrc;

    // Offscreen buffer — low-res, upscaled with smoothing
    const BUF = 96;
    const wc   = document.createElement("canvas");
    wc.width = BUF; wc.height = BUF;
    const wCtx  = wc.getContext("2d")!;
    const frame = wCtx.createImageData(BUF, BUF);
    const d     = frame.data;

    // 45° chevron constants
    const COS = Math.SQRT1_2; // cos(45°)
    const SIN = Math.SQRT1_2; // sin(45°)
    const FREQ    = 7;   // stripes visible across diagonal
    const SPEED   = 0.14; // wave advance per second (in stripe units)
    const FEATHER = 0.015; // soft edge half-width (fraction of stripe)

    let t = 0;

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      t += 0.008;

      for (let py = 0; py < BUF; py++) {
        for (let px = 0; px < BUF; px++) {
          const nx = px / BUF;
          const ny = py / BUF;

          // Diagonal projection → triangle wave → two-color stripe
          const proj  = nx * COS + ny * SIN;
          const phase = ((proj * FREQ - t * SPEED) % 1 + 1) % 1;
          const tri   = phase < 0.5 ? phase * 2 : (1 - phase) * 2; // 0–1 triangle wave

          // Soft threshold at 0.5
          const f = Math.max(0, Math.min(1, (tri - (0.5 - FEATHER)) / (2 * FEATHER)));

          const r = Math.round(col1[0] + (col2[0] - col1[0]) * f);
          const g = Math.round(col1[1] + (col2[1] - col1[1]) * f);
          const b = Math.round(col1[2] + (col2[2] - col1[2]) * f);

          const idx = (py * BUF + px) * 4;
          d[idx] = r; d[idx + 1] = g; d[idx + 2] = b; d[idx + 3] = 255;
        }
      }

      wCtx.putImageData(frame, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.globalAlpha = 0.40;
      ctx.drawImage(wc, 0, 0, W, H);
      ctx.globalAlpha = 1;
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, [imageSrc]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ mixBlendMode: "overlay" }}
    />
  );
}
