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

    // 2D offscreen buffer — diagonal wave, upscaled with smoothing
    const BUF = 96;
    const waveC = document.createElement("canvas");
    waveC.width = BUF; waveC.height = BUF;
    const wCtx  = waveC.getContext("2d")!;
    const wData = wCtx.createImageData(BUF, BUF);
    const wd    = wData.data;

    // Diagonal at ~35°: more FREQ_Y than FREQ_X → mostly vertical travel
    const FREQ_X = 4.0;  // horizontal cycles
    const FREQ_Y = 9.0;  // vertical cycles (dominant)
    const SPD    = 3.5;  // travel speed
    const EDGE   = 0.20; // blend softness

    let t = 0;

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      t += 0.020;

      for (let py = 0; py < BUF; py++) {
        for (let px = 0; px < BUF; px++) {
          const nx = px / BUF, ny = py / BUF;
          // Diagonal wave: nx + ny projection traveling top→bottom
          const wave = (Math.sin((nx * FREQ_X + ny * FREQ_Y) * Math.PI - t * SPD) + 1) / 2;
          const f = Math.max(0, Math.min(1, (wave - (0.5 - EDGE)) / (2 * EDGE)));
          const idx = (py * BUF + px) * 4;
          wd[idx]   = Math.round(col1[0] + (col2[0] - col1[0]) * f);
          wd[idx+1] = Math.round(col1[1] + (col2[1] - col1[1]) * f);
          wd[idx+2] = Math.round(col1[2] + (col2[2] - col1[2]) * f);
          wd[idx+3] = 255;
        }
      }
      wCtx.putImageData(wData, 0, 0);

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
      style={{ mixBlendMode: "color" }}
    />
  );
}
