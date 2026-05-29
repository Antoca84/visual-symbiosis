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

    // Luma map + dominant colors via median split
    const RES = 96;
    let lumaMap: Float32Array | null = null;
    let mapW = RES, mapH = RES;
    let col1 = [18, 20, 32];
    let col2 = [100, 110, 130];

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      mapW = RES;
      mapH = Math.round(RES * img.height / img.width);
      const tc = document.createElement("canvas");
      tc.width = mapW; tc.height = mapH;
      const tCtx = tc.getContext("2d")!;
      tCtx.drawImage(img, 0, 0, mapW, mapH);
      const data = tCtx.getImageData(0, 0, mapW, mapH).data;

      lumaMap = new Float32Array(mapW * mapH);
      const lumas: number[] = [];
      for (let i = 0; i < mapW * mapH; i++) {
        const l = 0.299 * data[i*4] + 0.587 * data[i*4+1] + 0.114 * data[i*4+2];
        lumaMap[i] = l / 255;
        lumas.push(l);
      }
      lumas.sort((a, b) => a - b);
      const median = lumas[Math.floor(lumas.length / 2)];

      let r1=0,g1=0,b1=0,c1=0, r2=0,g2=0,b2=0,c2=0;
      for (let i = 0; i < mapW * mapH; i++) {
        const l = 0.299*data[i*4] + 0.587*data[i*4+1] + 0.114*data[i*4+2];
        if (l < median) { r1+=data[i*4]; g1+=data[i*4+1]; b1+=data[i*4+2]; c1++; }
        else            { r2+=data[i*4]; g2+=data[i*4+1]; b2+=data[i*4+2]; c2++; }
      }
      if (c1 > 0) col1 = [Math.round(r1/c1), Math.round(g1/c1), Math.round(b1/c1)];
      if (c2 > 0) col2 = [Math.round(r2/c2), Math.round(g2/c2), Math.round(b2/c2)];
    };
    img.src = imageSrc;

    const sampleLuma = (nx: number, ny: number): number => {
      if (!lumaMap) return 0.5;
      const ix = Math.min(mapW - 1, Math.floor(nx * mapW));
      const iy = Math.min(mapH - 1, Math.floor(ny * mapH));
      return lumaMap[iy * mapW + ix];
    };

    // Offscreen duotone buffer
    const BUF = 96;
    const waveC = document.createElement("canvas");
    waveC.width = BUF; waveC.height = BUF;
    const wCtx  = waveC.getContext("2d")!;
    const wData = wCtx.createImageData(BUF, BUF);
    const wd    = wData.data;

    const FREQ_X = 3.5;
    const FREQ_Y = 8.0;
    const SPD    = 3.0;

    let t = 0;

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      t += 0.018;

      for (let py = 0; py < BUF; py++) {
        for (let px = 0; px < BUF; px++) {
          const nx = px / BUF, ny = py / BUF;
          const luma = sampleLuma(nx, ny);

          // Diagonal wave 0..1
          const raw = (Math.sin((nx * FREQ_X + ny * FREQ_Y) * Math.PI - t * SPD) + 1) / 2;
          // Sharpen edge: compress to 0.25..0.75 range → snap to hard boundary
          const wf = Math.max(0, Math.min(1, (raw - 0.25) / 0.50));

          // Duotone A: col1=dark, col2=light
          const aR = col1[0] + (col2[0] - col1[0]) * luma;
          const aG = col1[1] + (col2[1] - col1[1]) * luma;
          const aB = col1[2] + (col2[2] - col1[2]) * luma;

          // Duotone B: inverted assignment
          const bR = col2[0] + (col1[0] - col2[0]) * luma;
          const bG = col2[1] + (col1[1] - col2[1]) * luma;
          const bB = col2[2] + (col1[2] - col2[2]) * luma;

          // Wave selects between A and B
          const idx = (py * BUF + px) * 4;
          wd[idx]   = Math.round(aR + (bR - aR) * wf);
          wd[idx+1] = Math.round(aG + (bG - aG) * wf);
          wd[idx+2] = Math.round(aB + (bB - aB) * wf);
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
    />
  );
}
