import { useEffect, useRef } from "react";

// All positions in canvas-space (0-1), derived from image analysis
const LAMP_L   = { x: 0.26, y: 0.63, r: 0.16, depth: 1.0 };
const LAMP_R   = { x: 0.68, y: 0.67, r: 0.11, depth: 1.0 };
const MONITOR  = { x: 0.33, y: 0.66, r: 0.09, depth: 0.6 };
const CANDLE   = { x: 0.71, y: 0.73, r: 0.06, depth: 0.9 };
const SERVER   = { x: 0.10, y: 0.85, depth: 1.2 };

const LEDS = [
  { ox: 0,  oy: 0,  color: [0, 220, 255] as [number,number,number], freq: 0.9,  phase: 0 },
  { ox: 7,  oy: 0,  color: [0, 255, 100] as [number,number,number], freq: 1.4,  phase: 1.2 },
  { ox: 14, oy: 0,  color: [80, 180, 255] as [number,number,number], freq: 0.6,  phase: 2.5 },
  { ox: 0,  oy: 5,  color: [0, 255, 80]  as [number,number,number], freq: 2.1,  phase: 0.8 },
  { ox: 7,  oy: 5,  color: [255, 100, 0] as [number,number,number], freq: 1.0,  phase: 3.2 },
  { ox: 14, oy: 5,  color: [0, 220, 255] as [number,number,number], freq: 1.7,  phase: 1.6 },
  { ox: 0,  oy: 10, color: [0, 255, 100] as [number,number,number], freq: 0.7,  phase: 2.1 },
  { ox: 7,  oy: 10, color: [80, 180, 255] as [number,number,number], freq: 1.3,  phase: 0.4 },
];

interface GlowOpts {
  x: number; y: number;
  r: number;      // radius as fraction of W
  rY?: number;    // vertical radius fraction (default = r)
  cr: number; cg: number; cb: number;
  alpha: number;
}

export function AboutImageOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

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

    // Mouse parallax (global so it works when pointer is on left column)
    let mx = 0.5, my = 0.5;
    const onMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mx = (e.clientX - rect.left) / rect.width;
      my = (e.clientY - rect.top)  / rect.height;
    };
    window.addEventListener("mousemove", onMouse);

    const glow = ({ x, y, r, rY, cr, cg, cb, alpha }: GlowOpts) => {
      const cx = x * W, cy = y * H;
      const rx = r * W, ry = (rY ?? r) * H;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
      grad.addColorStop(0,    `rgba(${cr},${cg},${cb},${alpha})`);
      grad.addColorStop(0.35, `rgba(${cr},${cg},${cb},${(alpha * 0.35).toFixed(3)})`);
      grad.addColorStop(1,    `rgba(${cr},${cg},${cb},0)`);
      ctx.save();
      ctx.scale(1, ry / rx);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy * (rx / ry), rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    let t = 0;

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      t += 0.016;
      ctx.clearRect(0, 0, W, H);

      // Parallax offset per depth (max ±1.2% of W)
      const par = (depth: number) => ({
        dx: (mx - 0.5) * 0.024 * depth,
        dy: (my - 0.5) * 0.018 * depth,
      });

      // ── Left desk lamp ──────────────────────────────────────────────────
      const ll = par(LAMP_L.depth);
      const lpA = 0.32 + Math.sin(t * 0.7) * 0.07;
      glow({ x: LAMP_L.x + ll.dx, y: LAMP_L.y + ll.dy,
             r: LAMP_L.r, rY: LAMP_L.r * 0.7,
             cr: 255, cg: 185, cb: 80, alpha: lpA });
      // Second softer cone downward from lamp head
      glow({ x: LAMP_L.x + ll.dx, y: (LAMP_L.y + 0.05) + ll.dy,
             r: LAMP_L.r * 0.6, rY: LAMP_L.r * 1.1,
             cr: 255, cg: 200, cb: 100, alpha: lpA * 0.5 });

      // ── Right desk lamp ─────────────────────────────────────────────────
      const rl = par(LAMP_R.depth);
      const rpA = 0.22 + Math.sin(t * 0.55 + 1.4) * 0.05;
      glow({ x: LAMP_R.x + rl.dx, y: LAMP_R.y + rl.dy,
             r: LAMP_R.r, rY: LAMP_R.r * 0.75,
             cr: 255, cg: 190, cb: 90, alpha: rpA });

      // ── Monitor blue glow ───────────────────────────────────────────────
      const ml = par(MONITOR.depth);
      const mA = 0.14 + Math.sin(t * 1.2 + 0.5) * 0.03;
      glow({ x: MONITOR.x + ml.dx, y: MONITOR.y + ml.dy,
             r: MONITOR.r, rY: MONITOR.r * 0.65,
             cr: 70, cg: 140, cb: 255, alpha: mA });

      // ── Candle right ────────────────────────────────────────────────────
      const cl = par(CANDLE.depth);
      const flicker = 0.18 + Math.sin(t * 3.8 + Math.sin(t * 7.1) * 0.4) * 0.06;
      glow({ x: CANDLE.x + cl.dx, y: CANDLE.y + cl.dy,
             r: CANDLE.r, cr: 255, cg: 140, cb: 40, alpha: flicker });

      // ── Server LED rack ─────────────────────────────────────────────────
      const sl = par(SERVER.depth);
      const sx = (SERVER.x + sl.dx) * W;
      const sy = (SERVER.y + sl.dy) * H;

      for (const led of LEDS) {
        const blink = (Math.sin(t * led.freq * Math.PI * 2 + led.phase) + 1) / 2;
        // Clamp to 0.1..1.0 so LEDs never fully off — just dim
        const alpha = 0.10 + blink * 0.90;
        const [r, g, b] = led.color;
        const lx = sx + led.ox, ly = sy + led.oy;

        // Soft halo
        const hg = ctx.createRadialGradient(lx, ly, 0, lx, ly, 12);
        hg.addColorStop(0, `rgba(${r},${g},${b},${(alpha * 0.45).toFixed(3)})`);
        hg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = hg;
        ctx.beginPath(); ctx.arc(lx, ly, 12, 0, Math.PI * 2); ctx.fill();

        // LED dot
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
        ctx.beginPath(); ctx.arc(lx, ly, 2.5, 0, Math.PI * 2); ctx.fill();
      }
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      window.removeEventListener("mousemove", onMouse);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ mixBlendMode: "screen" }}
    />
  );
}
