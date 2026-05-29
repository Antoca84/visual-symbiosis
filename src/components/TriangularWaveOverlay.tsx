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

    // ── Noise ─────────────────────────────────────────────────────────────────
    const _h = (n: number) => { const x = Math.sin(n) * 43758.5453; return x - Math.floor(x); };
    const n2 = (x: number, y: number) => {
      const ix = Math.floor(x), iy = Math.floor(y), fx = x-ix, fy = y-iy;
      const ux = fx*fx*(3-2*fx), uy = fy*fy*(3-2*fy);
      const h = (a: number, b: number) => _h(a + b*57.3);
      return (h(ix,iy)*(1-ux)+h(ix+1,iy)*ux)*(1-uy)+(h(ix,iy+1)*(1-ux)+h(ix+1,iy+1)*ux)*uy;
    };
    const fbm = (x: number, y: number) =>
      n2(x,y)*0.500 + n2(x*2.1,y*2.1)*0.250 + n2(x*4.3,y*4.3)*0.125;

    const MOB = window.innerWidth < 768;
    const STRIP_H  = MOB ? 6 : 3;
    const MAX_DISP = MOB ? 3 : 7;
    const CHROMA   = MOB ? 1.5 : 3.5;

    // Source image canvas + isolated R / B channel canvases
    let srcC: HTMLCanvasElement | null = null;
    let redC: HTMLCanvasElement | null = null;
    let bluC: HTMLCanvasElement | null = null;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const IW = Math.min(img.width, 900);
      const IH = Math.round(img.height * IW / img.width);

      const makeCanvas = () => {
        const c = document.createElement("canvas");
        c.width = IW; c.height = IH;
        return c;
      };

      srcC = makeCanvas();
      srcC.getContext("2d")!.drawImage(img, 0, 0, IW, IH);

      // Red channel (zero G and B)
      redC = makeCanvas();
      const rCtx = redC.getContext("2d")!;
      rCtx.drawImage(img, 0, 0, IW, IH);
      const rData = rCtx.getImageData(0, 0, IW, IH);
      for (let i = 0; i < rData.data.length; i += 4) { rData.data[i+1] = 0; rData.data[i+2] = 0; }
      rCtx.putImageData(rData, 0, 0);

      // Blue channel (zero R and G)
      bluC = makeCanvas();
      const bCtx = bluC.getContext("2d")!;
      bCtx.drawImage(img, 0, 0, IW, IH);
      const bData = bCtx.getImageData(0, 0, IW, IH);
      for (let i = 0; i < bData.data.length; i += 4) { bData.data[i] = 0; bData.data[i+1] = 0; }
      bCtx.putImageData(bData, 0, 0);
    };
    img.src = imageSrc;

    let t = 0;

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      if (!srcC) return;
      t += 0.003;

      ctx.clearRect(0, 0, W, H);

      // ── Heat distortion: horizontal strip displacement ─────────────────────
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      const numStrips = Math.ceil(H / STRIP_H);
      const srcH = srcC.height, srcW = srcC.width;

      for (let i = 0; i < numStrips; i++) {
        const destY = i * STRIP_H;
        const destH = Math.min(STRIP_H + 1, H - destY); // +1 closes inter-strip gap
        const ny = destY / H;
        // FBM noise field sliding top → bottom: subtract t from y-sample so
        // pattern travels downward; second arg constant → no global x-correlation
        const disp = (fbm(ny * 1.8 - t * 0.60, 3.7) - 0.5) * 2 * MAX_DISP
                   + (fbm(ny * 4.8 - t * 0.90, 9.2) - 0.5) * 2 * MAX_DISP * 0.28;
        const srcY0 = Math.round(ny * srcH);
        const srcH0 = Math.max(1, Math.round(destH / H * srcH));
        ctx.drawImage(srcC, 0, srcY0, srcW, srcH0, disp, destY, W, destH);
      }

      // ── Chromatic aberration ───────────────────────────────────────────────
      if (redC && bluC) {
        const cx = Math.sin(t * 0.31) * CHROMA;
        const cy = Math.cos(t * 0.24) * CHROMA * 0.35;

        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = 0.28;
        ctx.drawImage(redC,  cx,  cy, W, H);
        ctx.globalAlpha = 0.28;
        ctx.drawImage(bluC, -cx, -cy, W, H);
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
    />
  );
}
