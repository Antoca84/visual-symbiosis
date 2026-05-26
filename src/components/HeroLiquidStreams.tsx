import { useEffect, useRef } from "react";
import { MotionValue } from "framer-motion";

// ── Noise ─────────────────────────────────────────────────────────────────────
const _hs = (n: number) => { const x = Math.sin(n) * 43758.5453; return x - Math.floor(x); };
function vnoise2(x: number, y: number): number {
  const ix=Math.floor(x), iy=Math.floor(y);
  const fx=x-ix, fy=y-iy;
  const ux=fx*fx*(3-2*fx), uy=fy*fy*(3-2*fy);
  const h=(a:number,b:number)=>_hs(a+b*57.3);
  const lr=(a:number,b:number,t:number)=>a+t*(b-a);
  return lr(lr(h(ix,iy),h(ix+1,iy),ux),lr(h(ix,iy+1),h(ix+1,iy+1),ux),uy);
}
function fbm2(x: number, y: number, o = 5): number {
  let v=0,a=0.5,f=1;
  for(let i=0;i<o;i++){ v+=a*vnoise2(x*f,y*f); a*=0.5; f*=2; }
  return v;
}

const BG = [12, 14, 20] as const;
// Palette
const DEEP_BLUE: [number,number,number]  = [26,  64,  102];
const COLD_BLUE: [number,number,number]  = [58,  134, 214];
const BONE:      [number,number,number]  = [221, 213, 192];
const ARTERIAL:  [number,number,number]  = [147, 37,  37];

function lerpC(a:[number,number,number], b:[number,number,number], t:number): [number,number,number] {
  const c = Math.max(0,Math.min(1,t));
  return [Math.round(a[0]+(b[0]-a[0])*c), Math.round(a[1]+(b[1]-a[1])*c), Math.round(a[2]+(b[2]-a[2])*c)];
}

// ── Stream ────────────────────────────────────────────────────────────────────
type Layer = 0 | 1 | 2;

interface Pt { x: number; y: number; }

interface Stream {
  pts:    Pt[];        // tail history — index 0 oldest, last = head
  maxLen: number;
  speed:  number;
  width:  number;
  layer:  Layer;
  nz:     number;     // noise Z offset — unique path per stream
  colorT: number;     // 0=deep blue, 1=bone white
  redT:   number;     // 0..1 arterial red mix (speed-based, computed per frame)
}

function spawnStream(W: number, H: number): Stream {
  const layer: Layer = Math.random() < 0.38 ? 0 : Math.random() < 0.62 ? 1 : 2;
  const [speed, width, maxLen] =
    layer === 0 ? [0.7  + Math.random(),       5  + Math.random() * 6,  50 + Math.random() * 40] :
    layer === 1 ? [1.4  + Math.random() * 1.5, 1.5+ Math.random() * 3,  80 + Math.random() * 70] :
                  [2.8  + Math.random() * 2.5, 0.4+ Math.random() * 1,  120+ Math.random() * 80];
  // Enter from left edge at random Y
  const startX = -30;
  const startY = H * 0.08 + Math.random() * H * 0.84;
  return {
    pts: [{ x: startX, y: startY }],
    maxLen: Math.round(maxLen),
    speed,
    width,
    layer,
    nz: Math.random() * 200,
    colorT: layer === 2 ? 0.55 + Math.random() * 0.45 : Math.random() * 0.45,
    redT: 0,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props { scrollYProgress: MotionValue<number>; }

export function HeroLiquidStreams({ scrollYProgress }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef  = useRef({ x: -9999, y: -9999 });
  const rafRef    = useRef<number>(0);
  const scrollRef = useRef(0);
  const tRef      = useRef(0);
  const streamsRef = useRef<Stream[]>([]);

  useEffect(() => scrollYProgress.on("change", v => { scrollRef.current = v; }), [scrollYProgress]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext("2d")!;
    let W = 0, H = 0;

    const resize = () => {
      W = canvas.width  = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
      // Reinit streams on resize
      streamsRef.current = Array.from({ length: 100 }, () => {
        const s = spawnStream(W, H);
        // Stagger initial X so they don't all start at edge
        s.pts[0].x = Math.random() * W;
        return s;
      });
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    canvas.addEventListener("mousemove", (e) => {
      const r = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    });
    canvas.addEventListener("mouseleave", () => { mouseRef.current = { x: -9999, y: -9999 }; });

    const NOISE_SCALE = 0.0025; // spatial scale — lower = larger, smoother swirls
    const MOUSE_R = 200;

    function draw() {
      rafRef.current = requestAnimationFrame(draw);
      tRef.current += 0.008;
      const t = tRef.current;
      const streams = streamsRef.current;
      const { x: mX, y: mY } = mouseRef.current;
      const scrollBoost = 1 + scrollRef.current * 1.5;

      // Partial clear — trail effect
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = `rgba(${BG[0]},${BG[1]},${BG[2]},0.10)`;
      ctx.fillRect(0, 0, W, H);

      // ── Advance each stream ───────────────────────────────────────────────────
      for (const s of streams) {
        const head = s.pts[s.pts.length - 1];

        // Angle from FBM noise — unique Z offset gives each stream its own path
        const angle = fbm2(head.x * NOISE_SCALE + s.nz, head.y * NOISE_SCALE + t * 0.25) * Math.PI * 4;
        // Bias rightward (cos angle is positive on average)
        const flowX = Math.cos(angle) * s.speed * scrollBoost;
        const flowY = Math.sin(angle) * s.speed * 0.55 * scrollBoost;

        // Mouse deflection
        let mx = 0, my = 0;
        if (mX > 0) {
          const dx = head.x - mX, dy = head.y - mY;
          const md = Math.sqrt(dx*dx + dy*dy);
          if (md < MOUSE_R && md > 1) {
            const str = (1 - md / MOUSE_R) ** 2 * 8;
            mx = (dx / md) * str;
            my = (dy / md) * str;
          }
        }

        const nx = head.x + flowX + mx;
        const ny = head.y + flowY + my;

        s.pts.push({ x: nx, y: ny });
        if (s.pts.length > s.maxLen) s.pts.shift();

        // Red tint when fast (mouse interaction)
        const boost = Math.sqrt(mx*mx + my*my);
        s.redT += (Math.min(1, boost / 6) - s.redT) * 0.12;

        // Respawn if head exits canvas
        if (nx > W + 40 || ny < -40 || ny > H + 40 || nx < -60) {
          const fresh = spawnStream(W, H);
          s.pts.length = 0;
          s.pts.push(fresh.pts[0]);
          s.speed  = fresh.speed;
          s.width  = fresh.width;
          s.nz     = fresh.nz;
          s.colorT = fresh.colorT;
          s.redT   = 0;
        }
      }

      // ── Draw (additive blend) ─────────────────────────────────────────────────
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Sort layers back-to-front
      const sorted = [...streams].sort((a, b) => a.layer - b.layer);

      for (const s of sorted) {
        if (s.pts.length < 2) continue;

        const [baseAlpha, layerW] =
          s.layer === 0 ? [0.045, 1.0] :
          s.layer === 1 ? [0.13,  1.0] :
                          [0.55,  1.0];

        // Draw tail as segments with fading alpha + width
        const n = s.pts.length;
        for (let i = 1; i < n; i++) {
          const tFrac = i / (n - 1);        // 0=tail, 1=head
          const tSq   = tFrac * tFrac;

          // Color: mix from DEEP_BLUE → COLD_BLUE → BONE by colorT, then redT
          let col: [number,number,number];
          if (s.colorT < 0.5) {
            col = lerpC(DEEP_BLUE, COLD_BLUE, s.colorT * 2);
          } else {
            col = lerpC(COLD_BLUE, BONE, (s.colorT - 0.5) * 2);
          }
          if (s.redT > 0.01) col = lerpC(col, ARTERIAL, s.redT * 0.7);

          const alpha  = baseAlpha * tSq;
          const lw     = s.width * layerW * tSq;

          if (alpha < 0.004 || lw < 0.15) continue;

          ctx.beginPath();
          ctx.moveTo(s.pts[i-1].x, s.pts[i-1].y);
          ctx.lineTo(s.pts[i].x, s.pts[i].y);
          ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${alpha.toFixed(4)})`;
          ctx.lineWidth = lw;
          ctx.stroke();
        }

        // Bright head dot
        const head = s.pts[s.pts.length - 1];
        let headCol: [number,number,number] =
          s.layer === 2 ? lerpC(BONE, COLD_BLUE, 0.2) :
          s.layer === 1 ? COLD_BLUE : DEEP_BLUE;
        if (s.redT > 0.05) headCol = lerpC(headCol, ARTERIAL, s.redT);
        ctx.fillStyle = `rgba(${headCol[0]},${headCol[1]},${headCol[2]},${(baseAlpha * 2.5).toFixed(4)})`;
        ctx.beginPath();
        ctx.arc(head.x, head.y, s.width * 0.9, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── Post ──────────────────────────────────────────────────────────────────
      ctx.globalCompositeOperation = "source-over";

      // Bottom dissolve
      const gd = ctx.createLinearGradient(0, H * 0.55, 0, H);
      gd.addColorStop(0, "rgba(0,0,0,0)");
      gd.addColorStop(1, `rgba(${BG[0]},${BG[1]},${BG[2]},1)`);
      ctx.fillStyle = gd;
      ctx.fillRect(0, 0, W, H);

      // Edge vignette
      const vig = ctx.createRadialGradient(W/2, H/2, W*0.22, W/2, H/2, W*0.80);
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, `rgba(${BG[0]},${BG[1]},${BG[2]},0.85)`);
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
