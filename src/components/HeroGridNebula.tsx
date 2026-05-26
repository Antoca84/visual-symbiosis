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
const BG        : [number,number,number] = [12,  14,  20];
const DEEP_BLUE : [number,number,number] = [26,  64,  102];
const COLD_BLUE : [number,number,number] = [58,  134, 214];
const BONE      : [number,number,number] = [221, 213, 192];
const ARTERIAL  : [number,number,number] = [147, 37,  37];

// ── Phase timing ──────────────────────────────────────────────────────────────
const P1 = 2.8;  // float duration (s)
const P2 = 2.6;  // converge duration (s)

// ── Grid config ───────────────────────────────────────────────────────────────
const COLS   = 52;
const ROWS   = 30;
const N_NODES = COLS * ROWS;
const SPAN_X = 4.4;  // ±4.4 world units — bleeds past screen edges
const SPAN_Y = 2.5;

// ── Node ──────────────────────────────────────────────────────────────────────
interface Node {
  rx: number; ry: number;       // grid rest position (world)
  x:  number; y:  number; z: number;  // current world position
  vx: number; vy: number; vz: number;
  dx: number; dy: number; dz: number; // spring displacement (phase 3)
  convDelay: number;  // 0..1 — normalised delay within P2 (center = 0, edge = ~0.75)
  locked: boolean;
  tier: 0 | 1 | 2;   // dot rendering tier during float
}

function makeNodes(): Node[] {
  const maxDist = Math.sqrt(SPAN_X * SPAN_X + SPAN_Y * SPAN_Y);
  return Array.from({ length: N_NODES }, (_, i) => {
    const c = i % COLS, r = Math.floor(i / COLS);
    const rx = (c / (COLS - 1) - 0.5) * SPAN_X * 2;
    const ry = (r / (ROWS - 1) - 0.5) * SPAN_Y * 2;
    // Random scatter initial position (sphere)
    const rad = Math.cbrt(Math.random()) * 2.4;
    const θ = Math.random() * Math.PI * 2;
    const φ = Math.acos(2 * Math.random() - 1);
    const roll = Math.random();
    return {
      rx, ry,
      x: rad * Math.sin(φ) * Math.cos(θ),
      y: rad * Math.sin(φ) * Math.sin(θ),
      z: (Math.random() - 0.5) * 2.5,
      vx: 0, vy: 0, vz: 0,
      dx: 0, dy: 0, dz: 0,
      // Center-outward convergence wave
      convDelay: (Math.sqrt(rx*rx + ry*ry) / maxDist) * 0.72,
      locked: false,
      tier: roll < 0.76 ? 0 : roll < 0.93 ? 1 : 2,
    };
  });
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props { scrollYProgress: MotionValue<number>; }

export function HeroGridNebula({ scrollYProgress }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const mouseRef   = useRef({ x: -9999, y: -9999 });
  const rafRef     = useRef<number>(0);
  const scrollRef  = useRef(0);
  const tRef       = useRef(0);
  const nodesRef   = useRef<Node[]>(makeNodes());
  const startRef   = useRef<number | null>(null);

  useEffect(() => scrollYProgress.on("change", v => { scrollRef.current = v; }), [scrollYProgress]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext("2d")!;
    let W = 0, H = 0;
    const nodes = nodesRef.current;

    const resize = () => { W = canvas.width = canvas.offsetWidth; H = canvas.height = canvas.offsetHeight; };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    canvas.addEventListener("mousemove", (e) => {
      const r = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    });
    canvas.addEventListener("mouseleave", () => { mouseRef.current = { x: -9999, y: -9999 }; });

    // Projection cache (avoid alloc per frame)
    type ProjResult = { sx: number; sy: number; s: number } | null;
    const projCache: ProjResult[] = new Array(N_NODES).fill(null);

    function project(wx: number, wy: number, wz: number, FL: number, camDist: number): ProjResult {
      const dz = wz + camDist;
      if (dz < 0.01) return null;
      const s = FL / dz;
      return { sx: W * 0.5 + wx * s, sy: H * 0.46 - wy * s, s };
    }

    function draw(ts: number) {
      rafRef.current = requestAnimationFrame(draw);
      if (startRef.current === null) startRef.current = ts;
      const elapsed = (ts - startRef.current) / 1000;
      tRef.current += 0.011;
      const t = tRef.current;

      const phase: "float" | "converge" | "grid" =
        elapsed < P1       ? "float" :
        elapsed < P1 + P2  ? "converge" : "grid";
      const phaseT = phase === "converge" ? Math.min(1, (elapsed - P1) / P2) : 1;

      // Adaptive projection params — fill more screen as grid is larger
      const FL      = Math.min(W, H) * 0.36;
      const CAM_DIST = 2.0;

      // ── Clear ────────────────────────────────────────────────────────────────
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = `rgba(${BG[0]},${BG[1]},${BG[2]},${phase === "grid" ? 0.13 : 0.11})`;
      ctx.fillRect(0, 0, W, H);

      const { x: mX, y: mY } = mouseRef.current;
      const scrollTiltY = scrollRef.current * 0.4;

      // ── Physics ───────────────────────────────────────────────────────────────
      for (const n of nodes) {
        if (phase === "float") {
          // FBM nebula flow
          const S = 0.48;
          const fnx = (fbm2(n.x * S + t * 0.26, n.y * S + 1.73) - 0.5) * 2;
          const fny = (fbm2(n.x * S + 7.31, n.y * S + t * 0.26 + 2.11) - 0.5) * 2;
          const fnz = (fbm2(n.z * 0.4 + t * 0.18, n.x * 0.3 + 4.0) - 0.5) * 2;
          n.vx += fnx * 0.0017;
          n.vy += fny * 0.0017;
          n.vz += fnz * 0.001;
          // Weak inward gravity
          const d = Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z);
          if (d > 0.9) { const g = (d - 0.9) * 0.00038; n.vx -= n.x * g; n.vy -= n.y * g; n.vz -= n.z * g; }
          n.vx *= 0.967; n.vy *= 0.967; n.vz *= 0.967;
          n.x += n.vx; n.y += n.vy; n.z += n.vz;

        } else if (phase === "converge" && !n.locked) {
          // Normalised local time for this node (0 before delay, 0→1 after)
          const localT = Math.max(0, (phaseT - n.convDelay) / Math.max(0.01, 1 - n.convDelay));

          if (localT > 0) {
            // Accelerating pull toward (rx, ry, 0)
            const force = localT * localT * 0.20;
            n.vx += (n.rx - n.x) * force;
            n.vy += (n.ry - n.y) * force;
            n.vz += (0    - n.z) * force;
          } else {
            // Still floating before delay
            const S = 0.48;
            n.vx += (fbm2(n.x * S + t * 0.22, n.y * S + 1.73) - 0.5) * 2 * 0.0011;
            n.vy += (fbm2(n.x * S + 7.31, n.y * S + t * 0.22 + 2.11) - 0.5) * 2 * 0.0011;
          }
          n.vx *= 0.86; n.vy *= 0.86; n.vz *= 0.86;
          n.x += n.vx; n.y += n.vy; n.z += n.vz;

          // Lock when close enough, or force-lock at phase end
          if (Math.hypot(n.x - n.rx, n.y - n.ry, n.z) < 0.05 || phaseT >= 0.999) {
            n.x = n.rx; n.y = n.ry; n.z = 0;
            n.vx = 0; n.vy = 0; n.vz = 0;
            n.locked = true;
          }

        } else if (phase === "grid") {
          // Ensure locked (in case converge ended early)
          if (!n.locked) { n.x = n.rx; n.y = n.ry; n.z = 0; n.locked = true; }
          // FBM Z breathing
          const noiseZ = (fbm2(n.rx * 0.6 + t * 0.10, n.ry * 0.6 + 2.7) - 0.5) * 0.08;
          n.x = n.rx + n.dx;
          n.y = n.ry + n.dy - scrollTiltY;
          n.z = n.dz + noiseZ;
          // Spring back
          const K = 0.072, DAMP = 0.878;
          n.vx += -n.dx * K; n.vy += -n.dy * K; n.vz += -n.dz * K;
          n.vx *= DAMP; n.vy *= DAMP; n.vz *= DAMP;
          n.dx += n.vx; n.dy += n.vy; n.dz += n.vz;
        }
      }

      // ── Project all ───────────────────────────────────────────────────────────
      for (let i = 0; i < N_NODES; i++) {
        const n = nodes[i];
        projCache[i] = project(n.x, n.y, n.z, FL, CAM_DIST);
      }

      // ── Mouse force (grid only) ───────────────────────────────────────────────
      if (phase === "grid" && mX > 0) {
        for (let i = 0; i < N_NODES; i++) {
          const pr = projCache[i];
          if (!pr) continue;
          const dx = pr.sx - mX, dy = pr.sy - mY;
          const md = Math.sqrt(dx * dx + dy * dy);
          if (md < 190) {
            const str = (1 - md / 190) ** 2 * 0.028;
            nodes[i].vz += str * 2.8;
            if (md > 1) { nodes[i].vx += (dx / md) * str * 0.35; nodes[i].vy -= (dy / md) * str * 0.35; }
          }
        }
      }

      // ── Draw ──────────────────────────────────────────────────────────────────
      ctx.globalCompositeOperation = "lighter";

      // --- Floating / converging dots (nebula style) ---
      if (phase !== "grid") {
        for (let i = 0; i < N_NODES; i++) {
          const n = nodes[i];
          if (n.locked) continue;
          const pr = projCache[i];
          if (!pr) continue;
          const { sx, sy, s } = pr;
          if (sx < -60 || sx > W + 60 || sy < -60 || sy > H + 60) continue;

          const depthT = Math.max(0, Math.min(1, (n.z + 3.5) / 5.0));
          let r: number, g: number, b: number;
          if (depthT < 0.42) {
            const f = depthT / 0.42;
            r = Math.round(DEEP_BLUE[0] + (COLD_BLUE[0] - DEEP_BLUE[0]) * f);
            g = Math.round(DEEP_BLUE[1] + (COLD_BLUE[1] - DEEP_BLUE[1]) * f);
            b = Math.round(DEEP_BLUE[2] + (COLD_BLUE[2] - DEEP_BLUE[2]) * f);
          } else {
            const f = (depthT - 0.42) / 0.58;
            r = Math.round(COLD_BLUE[0] + (BONE[0] - COLD_BLUE[0]) * f);
            g = Math.round(COLD_BLUE[1] + (BONE[1] - COLD_BLUE[1]) * f);
            b = Math.round(COLD_BLUE[2] + (BONE[2] - COLD_BLUE[2]) * f);
          }
          const [baseSize, baseAlpha] = n.tier === 2 ? [0.014, 0.92] : n.tier === 1 ? [0.007, 0.58] : [0.003, 0.32];
          const sz = Math.max(0.2, s * baseSize);
          const alpha = baseAlpha * depthT;
          if (alpha < 0.02) continue;

          ctx.fillStyle = `rgba(${r},${g},${b},${(alpha * 0.12).toFixed(4)})`;
          ctx.beginPath(); ctx.arc(sx, sy, sz * 3, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(4)})`;
          ctx.beginPath(); ctx.arc(sx, sy, sz, 0, Math.PI * 2); ctx.fill();
        }
      }

      // --- Grid lines (locked nodes during converge, all nodes during grid) ---
      if (phase === "converge" || phase === "grid") {
        ctx.lineCap = "round"; ctx.lineJoin = "round";

        const drawSeg = (i: number, j: number) => {
          const ni = nodes[i], nj = nodes[j];
          if (phase === "converge" && (!ni.locked || !nj.locked)) return;
          const a = projCache[i], b = projCache[j];
          if (!a || !b) return;

          const avgDz = (ni.dz + nj.dz) * 0.5;
          const t2 = Math.max(0, Math.min(1, avgDz * 1.8 + 0.45));
          let r: number, g: number, bl: number;
          if (t2 < 0.5) {
            const f = t2 * 2;
            r  = Math.round(DEEP_BLUE[0] + (COLD_BLUE[0] - DEEP_BLUE[0]) * f);
            g  = Math.round(DEEP_BLUE[1] + (COLD_BLUE[1] - DEEP_BLUE[1]) * f);
            bl = Math.round(DEEP_BLUE[2] + (COLD_BLUE[2] - DEEP_BLUE[2]) * f);
          } else {
            const f = (t2 - 0.5) * 2;
            const tC = avgDz > 0.5 ? ARTERIAL : BONE;
            r  = Math.round(COLD_BLUE[0] + (tC[0] - COLD_BLUE[0]) * f);
            g  = Math.round(COLD_BLUE[1] + (tC[1] - COLD_BLUE[1]) * f);
            bl = Math.round(COLD_BLUE[2] + (tC[2] - COLD_BLUE[2]) * f);
          }
          const disp  = Math.abs(avgDz);
          const alpha = Math.min(0.90, 0.20 + disp * 2.6);
          const lw    = Math.min(3.0, 0.65 + disp * 5.5);
          ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy);
          ctx.strokeStyle = `rgba(${r},${g},${bl},${alpha.toFixed(4)})`;
          ctx.lineWidth = lw; ctx.stroke();
        };

        for (let r = 0; r < ROWS; r++)
          for (let c = 0; c < COLS - 1; c++)
            drawSeg(r * COLS + c, r * COLS + c + 1);
        for (let r = 0; r < ROWS - 1; r++)
          for (let c = 0; c < COLS; c++)
            drawSeg(r * COLS + c, (r + 1) * COLS + c);

        // Hot-displacement nodes
        if (phase === "grid") {
          for (let i = 0; i < N_NODES; i++) {
            const pr = projCache[i];
            if (!pr) continue;
            const dz = nodes[i].dz;
            if (dz < 0.18) continue;
            const intensity = Math.min(1, (dz - 0.18) / 0.7);
            const col = dz > 0.5 ? ARTERIAL : BONE;
            ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${(intensity * 0.7).toFixed(4)})`;
            ctx.beginPath(); ctx.arc(pr.sx, pr.sy, intensity * 2.8, 0, Math.PI * 2); ctx.fill();
          }
        }
      }

      // ── Post ──────────────────────────────────────────────────────────────────
      ctx.globalCompositeOperation = "source-over";

      // Bottom dissolve into page
      const gd = ctx.createLinearGradient(0, H * 0.65, 0, H);
      gd.addColorStop(0, "rgba(0,0,0,0)");
      gd.addColorStop(1, `rgba(${BG[0]},${BG[1]},${BG[2]},1)`);
      ctx.fillStyle = gd; ctx.fillRect(0, 0, W, H);

      // Edge vignette — clips oversized grid cleanly
      const vig = ctx.createRadialGradient(W / 2, H / 2, W * 0.18, W / 2, H / 2, W * 0.82);
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, `rgba(${BG[0]},${BG[1]},${BG[2]},0.72)`);
      ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
    }

    rafRef.current = requestAnimationFrame(draw);
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
