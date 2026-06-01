import { useEffect, useRef, useState } from "react";

const COLS = 40;
const ROWS = 28;
const SPACING = 18;       // px tra nodi a riposo
const TEAR_DIST = 38;     // distanza rottura (px) — ~2.1× spacing
const GRAVITY = 0.25;
const DAMPING = 0.98;
const CONSTRAINT_ITER = 5;
const MOUSE_RADIUS = 90;
const MOUSE_FORCE = 6;

interface Point {
  x: number; y: number;
  px: number; py: number;  // posizione frame precedente (Verlet)
  pinned: boolean;
}

interface Constraint {
  a: number; b: number;
  restLen: number;
  active: boolean;
  tension: number;  // 0–1
}

function init(W: number, H: number): { points: Point[]; constraints: Constraint[] } {
  const offX = (W - (COLS - 1) * SPACING) / 2;
  const offY = H * 0.12;

  const points: Point[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = offX + c * SPACING;
      const y = offY + r * SPACING;
      points.push({ x, y, px: x, py: y, pinned: r === 0 && c % 4 === 0 });
    }
  }

  const constraints: Constraint[] = [];
  const push = (a: number, b: number) => {
    const dx = points[a].x - points[b].x;
    const dy = points[a].y - points[b].y;
    constraints.push({ a, b, restLen: Math.sqrt(dx * dx + dy * dy), active: true, tension: 0 });
  };
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      if (c < COLS - 1) push(i, i + 1);
      if (r < ROWS - 1) push(i, i + COLS);
    }

  return { points, constraints };
}

export function ClothDemo({ showControls = false }: { showControls?: boolean } = {}) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const mouseRef   = useRef({ x: -9999, y: -9999, down: false });
  const rafRef     = useRef<number>(0);
  const pausedRef  = useRef(false);
  const resetRef   = useRef(false);
  const [paused, setPaused] = useState(false);

  const togglePause = () => { pausedRef.current = !pausedRef.current; setPaused(p => !p); };
  const triggerReset = () => { resetRef.current = true; };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext("2d")!;
    let W = 0, H = 0;
    let pts: Point[] = [];
    let cs: Constraint[]  = [];

    const resize = () => {
      W = canvas.offsetWidth;
      H = canvas.offsetHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width  = W * dpr;
      canvas.height = H * dpr;
      ctx.scale(dpr, dpr);
      const d = init(W, H);
      pts = d.points; cs = d.constraints;
    };
    resize();
    window.addEventListener("resize", resize);

    // Mouse / touch
    const getPos = (e: MouseEvent | Touch) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onMove = (e: MouseEvent) => { const p = getPos(e); mouseRef.current.x = p.x; mouseRef.current.y = p.y; };
    const onDown = (e: MouseEvent) => { mouseRef.current.down = true; onMove(e); };
    const onUp   = () => { mouseRef.current.down = false; };
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const p = getPos(e.touches[0]);
      mouseRef.current.x = p.x; mouseRef.current.y = p.y;
    };
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchstart", (e) => { mouseRef.current.down = true; onTouchMove(e as unknown as TouchEvent); });
    canvas.addEventListener("touchend", () => { mouseRef.current.down = false; });

    function draw() {
      rafRef.current = requestAnimationFrame(draw);
      if (resetRef.current) { resetRef.current = false; const d = init(W, H); pts = d.points; cs = d.constraints; }
      if (pausedRef.current) return;
      const { x: mx, y: my, down } = mouseRef.current;

      // ── Physics ──────────────────────────────────────────────────────────────
      for (const p of pts) {
        if (p.pinned) continue;
        const vx = (p.x - p.px) * DAMPING;
        const vy = (p.y - p.py) * DAMPING;
        p.px = p.x; p.py = p.y;
        p.x += vx;
        p.y += vy + GRAVITY;

        // Mouse force — trascina punti vicini
        const dx = p.x - mx, dy = p.y - my;
        const md = Math.sqrt(dx * dx + dy * dy);
        if (md < MOUSE_RADIUS) {
          const prox = (1 - md / MOUSE_RADIUS);
          if (down) {
            // Drag
            p.x += (mx - p.x) * prox * 0.22;
            p.y += (my - p.y) * prox * 0.22;
          } else {
            // Hover: piccola repulsione
            const f = prox * MOUSE_FORCE * 0.3;
            p.x += (dx / (md + 0.01)) * f;
            p.y += (dy / (md + 0.01)) * f;
          }
        }
      }

      // ── Constraint solving ────────────────────────────────────────────────
      for (let iter = 0; iter < CONSTRAINT_ITER; iter++) {
        for (const c of cs) {
          if (!c.active) continue;
          const pa = pts[c.a], pb = pts[c.b];
          const dx = pa.x - pb.x, dy = pa.y - pb.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
          c.tension = Math.max(0, Math.min(1, (dist - c.restLen) / (TEAR_DIST - c.restLen)));

          if (dist > TEAR_DIST) { c.active = false; continue; }

          const diff = (dist - c.restLen) / dist * 0.5;
          const ox = dx * diff, oy = dy * diff;
          if (!pa.pinned) { pa.x -= ox; pa.y -= oy; }
          if (!pb.pinned) { pb.x += ox; pb.y += oy; }
        }
      }

      // ── Draw ────────────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#0b0d14";
      ctx.fillRect(0, 0, W, H);

      ctx.lineCap = "round";
      for (const c of cs) {
        if (!c.active) continue;
        const pa = pts[c.a], pb = pts[c.b];
        const ten = c.tension;

        let r: number, g: number, b: number;
        if (ten > 0.65) {
          const f = (ten - 0.65) / 0.35;
          r = Math.round(147 + (255 - 147) * f);
          g = Math.round(37  * (1 - f * 0.7));
          b = Math.round(37  * (1 - f * 0.9));
        } else if (ten > 0.2) {
          const f = (ten - 0.2) / 0.45;
          r = Math.round(58  + (147 - 58)  * f);
          g = Math.round(134 + (37  - 134) * f);
          b = Math.round(214 + (37  - 214) * f);
        } else {
          r = 58; g = 134; b = 214;
        }

        const alpha = 0.35 + ten * 0.6;
        const lw    = 0.6 + ten * 2.0;

        // Glow layer per alta tensione
        if (ten > 0.5) {
          ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
          ctx.strokeStyle = `rgba(${r},${g},${b},${(alpha * 0.2).toFixed(3)})`;
          ctx.lineWidth = lw * 5; ctx.stroke();
        }

        ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
        ctx.strokeStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
        ctx.lineWidth = lw; ctx.stroke();
      }

      // Pinned points
      for (const p of pts) {
        if (!p.pinned) continue;
        ctx.fillStyle = "rgba(58,134,214,0.6)";
        ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
      }
    }

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  return (
    <div className="w-full h-full relative">
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-crosshair"
        style={{ touchAction: "none" }}
      />
      {showControls && (
        <div className="absolute top-14 right-4 z-20 flex gap-2 pointer-events-auto select-none font-mono">
          <button
            onClick={triggerReset}
            className="text-[9px] tracking-[0.3em] uppercase text-white/55 hover:text-white/90
              border border-white/20 hover:border-white/40 px-4 py-2.5 backdrop-blur-sm
              bg-black/30 hover:bg-black/50 transition-colors min-h-[40px]"
          >
            Reset
          </button>
          <button
            onClick={togglePause}
            className={`text-[9px] tracking-[0.3em] uppercase border px-4 py-2.5 backdrop-blur-sm
              transition-colors min-h-[40px]
              ${paused
                ? "text-white/90 border-white/45 bg-black/50 hover:text-white hover:border-white/65"
                : "text-white/55 border-white/20 bg-black/30 hover:text-white/90 hover:border-white/40"
              }`}
          >
            {paused ? "▶ Play" : "⏸ Pause"}
          </button>
        </div>
      )}
    </div>
  );
}
