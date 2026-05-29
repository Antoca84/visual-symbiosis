import { useEffect, useRef } from "react";

// 6 rows total: 2+2+2, gap of 8px between pairs
const mkRow = (oy: number, seed: number) => [
  { ox: 0,  oy, c: [40, 220, 255] as [number,number,number], f: 2.1, p: seed },
  { ox: 5,  oy, c: [0,  255, 100] as [number,number,number], f: 1.4, p: seed+0.8 },
  { ox: 10, oy, c: [40, 200, 255] as [number,number,number], f: 0.7, p: seed+2.1 },
  { ox: 15, oy, c: [0,  255, 80]  as [number,number,number], f: 1.9, p: seed+1.3 },
  { ox: 20, oy, c: [40, 220, 255] as [number,number,number], f: 1.1, p: seed+3.2 },
  { ox: 25, oy, c: [0,  200, 255] as [number,number,number], f: 2.5, p: seed+0.5 },
];
const mkRow2 = (oy: number, seed: number) => [
  { ox: 0,  oy, c: [0,  255, 80]  as [number,number,number], f: 0.5, p: seed },
  { ox: 5,  oy, c: [255, 90,  0]  as [number,number,number], f: 0.3, p: seed+1.0 },
  { ox: 10, oy, c: [40, 220, 255] as [number,number,number], f: 0.4, p: seed+2.2 },
  { ox: 15, oy, c: [0,  255, 100] as [number,number,number], f: 0.6, p: seed+0.9 },
  { ox: 20, oy, c: [40, 180, 255] as [number,number,number], f: 1.6, p: seed+2.7 },
  { ox: 25, oy, c: [0,  255, 80]  as [number,number,number], f: 1.2, p: seed+1.5 },
];
// pair1: oy 0,4 | gap 8px | pair2: oy 12,16 | gap 8px | pair3: oy 24,28
const LEDS = [
  ...mkRow(0,  0.0), ...mkRow2(4,  0.3),
  ...mkRow(12, 1.1), ...mkRow2(16, 1.4),
  ...mkRow(24, 2.2), ...mkRow2(28, 2.5),
];

interface Props {
  ledX?: number;
  ledY?: number;
  ledScale?: number;
  lightsOn?: boolean;
}

export function AboutImageOverlay({
  ledX = 0.215,
  ledY = 0.720,
  ledScale = 1,
  lightsOn = true,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const propsRef  = useRef({ ledX, ledY, ledScale, lightsOn });
  propsRef.current = { ledX, ledY, ledScale, lightsOn };

  useEffect(() => {
    if (window.innerWidth < 768) return;

    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext("2d")!;
    let W = 0, H = 0;

    const resize = () => {
      W = canvas.offsetWidth;
      H = canvas.offsetHeight;
      canvas.width  = W;
      canvas.height = H;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const glow = (
      nx: number, ny: number,
      rW: number, rH: number,
      r: number, g: number, b: number,
      peak: number
    ) => {
      const cx = nx * W, cy = ny * H;
      const rx = rW * W, ry = rH * H;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, ry / rx);
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      grad.addColorStop(0,   `rgba(${r},${g},${b},${peak.toFixed(3)})`);
      grad.addColorStop(0.4, `rgba(${r},${g},${b},${(peak * 0.25).toFixed(3)})`);
      grad.addColorStop(1,   `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    let t = 0;

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      t += 0.016;
      ctx.clearRect(0, 0, W, H);

      const { ledX, ledY, ledScale, lightsOn } = propsRef.current;
      if (!lightsOn) return;

      // ── Left desk lamp ──────────────────────────────────────────────────
      const lPulse = 0.22 + Math.sin(t * 0.65) * 0.05;
      glow(0.245, 0.620, 0.06, 0.05, 255, 210, 130, lPulse * 0.9);
      glow(0.235, 0.680, 0.14, 0.07, 255, 190, 80,  lPulse * 0.55);
      glow(0.235, 0.660, 0.22, 0.12, 255, 160, 60,  lPulse * 0.20);

      // ── Right desk lamp ─────────────────────────────────────────────────
      const rPulse = 0.16 + Math.sin(t * 0.5 + 1.3) * 0.04;
      glow(0.670, 0.655, 0.05, 0.04, 255, 210, 120, rPulse * 0.85);
      glow(0.665, 0.700, 0.10, 0.06, 255, 185, 75,  rPulse * 0.50);
      glow(0.665, 0.680, 0.17, 0.10, 255, 155, 55,  rPulse * 0.18);

      // ── Monitor ambient ──────────────────────────────────────────────────
      const mPulse = 0.09 + Math.sin(t * 1.1 + 0.5) * 0.02;
      glow(0.340, 0.660, 0.10, 0.06, 60, 140, 255, mPulse);

      // ── Server LEDs ──────────────────────────────────────────────────────
      const sx = ledX * W;
      const sy = ledY * H;
      const dot  = 0.5 * ledScale;  // 50% rispetto a prima (era 1.0)
      const halo = 2.0 * ledScale;  // 50% rispetto a prima (era 4.0)

      for (const led of LEDS) {
        const blink = (Math.sin(t * led.f * Math.PI * 2 + led.p) + 1) / 2;
        const alpha = 0.12 + blink * 0.88;
        const [r, g, b] = led.c;
        const lx = sx + led.ox * ledScale;
        const ly = sy + led.oy * ledScale;

        const hg = ctx.createRadialGradient(lx, ly, 0, lx, ly, halo);
        hg.addColorStop(0, `rgba(${r},${g},${b},${(alpha * 0.5).toFixed(3)})`);
        hg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = hg;
        ctx.beginPath(); ctx.arc(lx, ly, halo, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
        ctx.beginPath(); ctx.arc(lx, ly, dot, 0, Math.PI * 2); ctx.fill();
      }
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ mixBlendMode: "screen" }}
    />
  );
}
