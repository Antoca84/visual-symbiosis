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

    // Extract two dominant colors from image via luma median split
    let col1 = [18, 20, 32];   // dark fallback
    let col2 = [100, 110, 130]; // light fallback

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
        lumas.push(0.299 * data[i*4] + 0.587 * data[i*4+1] + 0.114 * data[i*4+2]);
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

    // 1×BUF buffer: one pixel per row, each row gets col1 or col2 blended by wave
    const BUF = 256;
    const waveC = document.createElement("canvas");
    waveC.width = 1; waveC.height = BUF;
    const wCtx  = waveC.getContext("2d")!;
    const wData = wCtx.createImageData(1, BUF);
    const wd    = wData.data;

    const FREQ = 3.2;  // wave cycles visible vertically
    const SPD  = 1.4;  // travel speed top → bottom
    const EDGE = 0.08; // soft edge width between colors (0 = hard, 0.5 = full blend)

    let t = 0;

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      t += 0.005;

      // Build wave: each row blends between col1 and col2
      for (let py = 0; py < BUF; py++) {
        const ny   = py / BUF;
        const wave = (Math.sin(ny * Math.PI * 2 * FREQ - t * SPD) + 1) / 2; // 0..1
        // Soft threshold: hard boundary with slight feather
        const f = Math.max(0, Math.min(1, (wave - (0.5 - EDGE)) / (2 * EDGE)));
        const idx = py * 4;
        wd[idx]   = Math.round(col1[0] + (col2[0] - col1[0]) * f);
        wd[idx+1] = Math.round(col1[1] + (col2[1] - col1[1]) * f);
        wd[idx+2] = Math.round(col1[2] + (col2[2] - col1[2]) * f);
        wd[idx+3] = 255;
      }
      wCtx.putImageData(wData, 0, 0);

      // Scale 1×BUF → W×H: replaces image with animated 2-color wave
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(waveC, 0, 0, W, H);
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
