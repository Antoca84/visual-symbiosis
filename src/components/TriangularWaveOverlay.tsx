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

    // Extract two dominant colors via luma median split
    let col1 = [10, 12, 22];
    let col2 = [140, 155, 180];

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
      // Push colors apart for clear contrast
      if (c1 > 0) col1 = [Math.round(r1/c1*0.3), Math.round(g1/c1*0.3), Math.round(b1/c1*0.3)];
      if (c2 > 0) col2 = [
        Math.min(255, Math.round(r2/c2*2.0 + 40)),
        Math.min(255, Math.round(g2/c2*2.0 + 50)),
        Math.min(255, Math.round(b2/c2*1.8 + 60)),
      ];
    };
    img.src = imageSrc;

    const CELL  = 48;  // triangle grid cell size (px)
    const FREQ  = 2.8; // wave frequency across grid
    const SPD   = 1.8; // animation speed
    let t = 0;

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      t += 0.016;

      ctx.clearRect(0, 0, W, H);

      const cols = Math.ceil(W / CELL) + 1;
      const rows = Math.ceil(H / CELL) + 1;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x0 = col * CELL,        y0 = row * CELL;
          const x1 = (col + 1) * CELL,  y1 = row * CELL;
          const x2 = col * CELL,        y2 = (row + 1) * CELL;
          const x3 = (col + 1) * CELL,  y3 = (row + 1) * CELL;

          // Upper-left triangle centroid
          const cxa = (x0 + x1 + x2) / 3;
          const cya = (y0 + y1 + y2) / 3;
          const phaseA = (cxa / W + cya / H * 1.6) * Math.PI * FREQ - t * SPD;
          const fa = Math.sin(phaseA) > 0;

          ctx.beginPath();
          ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2);
          ctx.closePath();
          ctx.fillStyle = fa
            ? `rgb(${col2[0]},${col2[1]},${col2[2]})`
            : `rgb(${col1[0]},${col1[1]},${col1[2]})`;
          ctx.fill();

          // Lower-right triangle centroid
          const cxb = (x1 + x2 + x3) / 3;
          const cyb = (y1 + y2 + y3) / 3;
          const phaseB = (cxb / W + cyb / H * 1.6) * Math.PI * FREQ - t * SPD;
          const fb = Math.sin(phaseB) > 0;

          ctx.beginPath();
          ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3);
          ctx.closePath();
          ctx.fillStyle = fb
            ? `rgb(${col2[0]},${col2[1]},${col2[2]})`
            : `rgb(${col1[0]},${col1[1]},${col1[2]})`;
          ctx.fill();
        }
      }
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, [imageSrc]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ mixBlendMode: "overlay", opacity: 0.85 }}
    />
  );
}
