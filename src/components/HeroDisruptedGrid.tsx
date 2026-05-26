import { useEffect, useRef } from "react";
import { MotionValue } from "framer-motion";

// ── Noise ─────────────────────────────────────────────────────────────────────
const _hs = (n: number) => { const x = Math.sin(n) * 43758.5453; return x - Math.floor(x); };
function vnoise2(x: number, y: number): number {
  const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
  const ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy);
  const h=(a:number,b:number)=>_hs(a+b*57.3);
  const lr=(a:number,b:number,t:number)=>a+t*(b-a);
  return lr(lr(h(ix,iy),h(ix+1,iy),ux),lr(h(ix,iy+1),h(ix+1,iy+1),ux),uy);
}
function fbm2(x: number, y: number, o = 4): number {
  let v=0,a=0.5,f=1;
  for(let i=0;i<o;i++){v+=a*vnoise2(x*f,y*f);a*=0.5;f*=2;}
  return v;
}

// ── Palette ───────────────────────────────────────────────────────────────────
const BG:        [number,number,number] = [12,  14,  20];
const DEEP_BLUE: [number,number,number] = [26,  64,  102];
const COLD_BLUE: [number,number,number] = [58,  134, 214];
const BONE:      [number,number,number] = [221, 213, 192];
const ARTERIAL:  [number,number,number] = [147, 37,  37];

// ── Grid ──────────────────────────────────────────────────────────────────────
const COLS = 46;
const ROWS = 28;
const N    = COLS * ROWS;

interface Pt {
  rx: number; ry: number; // rest position (world)
  dx: number; dy: number; dz: number;
  vx: number; vy: number; vz: number;
}

function buildGrid(): Pt[] {
  return Array.from({ length: N }, (_, i) => {
    const c = i % COLS, r = Math.floor(i / COLS);
    return {
      rx: (c / (COLS-1) - 0.5) * 3.0,
      ry: (r / (ROWS-1) - 0.5) * 1.85,
      dx: 0, dy: 0, dz: 0,
      vx: 0, vy: 0, vz: 0,
    };
  });
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props { scrollYProgress: MotionValue<number>; }

export function HeroDisruptedGrid({ scrollYProgress }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef  = useRef({ x: -9999, y: -9999 });
  const rafRef    = useRef<number>(0);
  const scrollRef = useRef(0);
  const tRef      = useRef(0);
  const ptsRef    = useRef<Pt[]>(buildGrid());

  useEffect(() => scrollYProgress.on("change", v => { scrollRef.current = v; }), [scrollYProgress]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext("2d")!;
    let W = 0, H = 0;
    const pts = ptsRef.current;

    const resize = () => { W = canvas.width = canvas.offsetWidth; H = canvas.height = canvas.offsetHeight; };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    canvas.addEventListener("mousemove", (e) => {
      const r = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    });
    canvas.addEventListener("mouseleave", () => { mouseRef.current = { x: -9999, y: -9999 }; });

    const FL = 460;
    const CAM_Z = -3.6;

    function project(wx: number, wy: number, wz: number) {
      const dz = wz - CAM_Z;
      if (dz < 0.01) return null;
      const s = FL / dz;
      return { sx: W * 0.5 + wx * s, sy: H * 0.48 - wy * s, s };
    }

    // Pre-allocated projection cache
    const proj: Array<{ sx: number; sy: number; s: number } | null> = new Array(N).fill(null);

    function draw() {
      rafRef.current = requestAnimationFrame(draw);
      tRef.current += 0.010;
      const t   = tRef.current;
      const { x: mX, y: mY } = mouseRef.current;
      // Scroll slowly tilts the grid upward (Y offset)
      const tiltY = scrollRef.current * 0.4;

      // ── Background ───────────────────────────────────────────────────────────
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = `rgba(${BG[0]},${BG[1]},${BG[2]},0.28)`;
      ctx.fillRect(0, 0, W, H);

      // ── Physics + project ─────────────────────────────────────────────────────
      const MOUSE_R = 185;
      const K = 0.072, DAMP = 0.875;

      for (let i = 0; i < N; i++) {
        const p = pts[i];

        // Noise Z breathing — slow organic wave
        const noiseZ = (fbm2(p.rx * 0.6 + t * 0.12, p.ry * 0.6 + 2.7) - 0.5) * 0.08;

        // World position
        const wx = p.rx + p.dx;
        const wy = p.ry + p.dy - tiltY;
        const wz = p.dz + noiseZ;

        proj[i] = project(wx, wy, wz);

        // Spring back to rest
        p.vx += -p.dx * K;
        p.vy += -p.dy * K;
        p.vz += -p.dz * K;
        p.vx *= DAMP; p.vy *= DAMP; p.vz *= DAMP;
        p.dx += p.vx; p.dy += p.vy; p.dz += p.vz;
      }

      // ── Mouse force ───────────────────────────────────────────────────────────
      if (mX > 0) {
        for (let i = 0; i < N; i++) {
          const pr = proj[i];
          if (!pr) continue;
          const dx = pr.sx - mX, dy = pr.sy - mY;
          const md = Math.sqrt(dx*dx + dy*dy);
          if (md < MOUSE_R) {
            const str = (1 - md / MOUSE_R) ** 2 * 0.028;
            pts[i].vz += str * 2.8;       // surge toward camera
            if (md > 1) {
              pts[i].vx += (dx / md) * str * 0.35;
              pts[i].vy -= (dy / md) * str * 0.35;
            }
          }
        }
      }

      // ── Draw grid (additive blend) ────────────────────────────────────────────
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap  = "round";
      ctx.lineJoin = "round";

      function segment(i: number, j: number) {
        const a = proj[i], b = proj[j];
        if (!a || !b) return;
        const pi = pts[i], pj = pts[j];
        const avgDz = (pi.dz + pj.dz) * 0.5;

        // Map avgDz → color: negative (pushed back) = dark blue, positive (surging) = bone/white
        const t2 = Math.max(0, Math.min(1, avgDz * 1.8 + 0.45));
        let r: number, g: number, bl: number;
        if (t2 < 0.5) {
          const f = t2 * 2;
          r  = Math.round(DEEP_BLUE[0] + (COLD_BLUE[0] - DEEP_BLUE[0]) * f);
          g  = Math.round(DEEP_BLUE[1] + (COLD_BLUE[1] - DEEP_BLUE[1]) * f);
          bl = Math.round(DEEP_BLUE[2] + (COLD_BLUE[2] - DEEP_BLUE[2]) * f);
        } else {
          const f = (t2 - 0.5) * 2;
          // Hot tip: extreme displacement goes arterial red
          const targetC = avgDz > 0.5 ? ARTERIAL : BONE;
          r  = Math.round(COLD_BLUE[0] + (targetC[0] - COLD_BLUE[0]) * f);
          g  = Math.round(COLD_BLUE[1] + (targetC[1] - COLD_BLUE[1]) * f);
          bl = Math.round(COLD_BLUE[2] + (targetC[2] - COLD_BLUE[2]) * f);
        }

        const disp    = Math.abs(avgDz);
        const alpha   = Math.min(0.88, 0.06 + disp * 2.2);
        const lw      = Math.min(2.8, 0.4 + disp * 5.5);

        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.strokeStyle = `rgba(${r},${g},${bl},${alpha.toFixed(4)})`;
        ctx.lineWidth   = lw;
        ctx.stroke();
      }

      // Horizontal segments
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS-1; c++)
          segment(r*COLS + c, r*COLS + c + 1);

      // Vertical segments
      for (let r = 0; r < ROWS-1; r++)
        for (let c = 0; c < COLS; c++)
          segment(r*COLS + c, (r+1)*COLS + c);

      // Node dots at highly displaced points
      for (let i = 0; i < N; i++) {
        const pr = proj[i];
        if (!pr) continue;
        const dz = pts[i].dz;
        if (dz < 0.18) continue;
        const intensity = Math.min(1, (dz - 0.18) / 0.7);
        const col = dz > 0.5 ? ARTERIAL : BONE;
        ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${(intensity * 0.7).toFixed(4)})`;
        ctx.beginPath();
        ctx.arc(pr.sx, pr.sy, intensity * 2.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── Post ──────────────────────────────────────────────────────────────────
      ctx.globalCompositeOperation = "source-over";

      // Bottom dissolve
      const gd = ctx.createLinearGradient(0, H * 0.50, 0, H);
      gd.addColorStop(0, "rgba(0,0,0,0)");
      gd.addColorStop(1, `rgba(${BG[0]},${BG[1]},${BG[2]},1)`);
      ctx.fillStyle = gd;
      ctx.fillRect(0, 0, W, H);

      // Edge vignette
      const vig = ctx.createRadialGradient(W/2, H/2, W*0.18, W/2, H/2, W*0.80);
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, `rgba(${BG[0]},${BG[1]},${BG[2]},0.88)`);
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);
    }

    draw();
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ display: "block" }}
    />
  );
}
