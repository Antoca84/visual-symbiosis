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

    // Static image canvas — drawn every frame, never displaced
    let srcC: HTMLCanvasElement | null = null;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const IW = Math.min(img.width, 900);
      const IH = Math.round(img.height * IW / img.width);
      srcC = document.createElement("canvas");
      srcC.width = IW; srcC.height = IH;
      srcC.getContext("2d")!.drawImage(img, 0, 0, IW, IH);
    };
    img.src = imageSrc;

    // 1×BUF wave buffer — only vertical variation matters, scaled to full W×H
    const BUF = 128;
    const waveC = document.createElement("canvas");
    waveC.width = 1; waveC.height = BUF;
    const wCtx  = waveC.getContext("2d")!;
    const wData = wCtx.createImageData(1, BUF);
    const wd    = wData.data;

    const FREQ  = 2.8;  // wave cycles visible vertically
    const SPD   = 0.80; // travel speed top → bottom
    const ALPHA = 210;  // overlay alpha (0–255); controls effect intensity

    let t = 0;

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      if (!srcC) return;
      t += 0.003;

      // ── Static image (no displacement) ────────────────────────────────────
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(srcC, 0, 0, W, H);

      // ── Color wave: 1-pixel-wide luminance strip, scaled to full canvas ───
      // overlay blend: luma > 128 brightens, < 128 darkens.
      // Traveling sine → alternating bright/dark bands slide top → bottom.
      for (let py = 0; py < BUF; py++) {
        const ny   = py / BUF;
        const wave = (Math.sin(ny * Math.PI * 2 * FREQ - t * SPD) + 1) / 2; // 0..1
        // Map to 80–176 to avoid clipping extremes; overlay stays subtle
        const luma = Math.round(80 + wave * 96);
        const idx  = py * 4;
        wd[idx] = luma; wd[idx + 1] = luma; wd[idx + 2] = luma; wd[idx + 3] = ALPHA;
      }
      wCtx.putImageData(wData, 0, 0);

      ctx.globalCompositeOperation = "overlay";
      ctx.globalAlpha = 1;
      ctx.drawImage(waveC, 0, 0, W, H);

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
