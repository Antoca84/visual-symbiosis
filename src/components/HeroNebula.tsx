import { useEffect, useRef } from "react";
import { MotionValue } from "framer-motion";

// ── Noise ─────────────────────────────────────────────────────────────────────
const _hs = (n: number) => { const x = Math.sin(n) * 43758.5453; return x - Math.floor(x); };
function vnoise(x: number, y: number, z = 0): number {
  const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);
  const fx=x-ix,fy=y-iy,fz=z-iz;
  const ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy),uz=fz*fz*(3-2*fz);
  const lr=(a:number,b:number,t:number)=>a+t*(b-a);
  const h=(a:number,b:number,c:number)=>_hs(a+b*57.3+c*113.7);
  return lr(lr(lr(h(ix,iy,iz),h(ix+1,iy,iz),ux),lr(h(ix,iy+1,iz),h(ix+1,iy+1,iz),ux),uy),
    lr(lr(h(ix,iy,iz+1),h(ix+1,iy,iz+1),ux),lr(h(ix,iy+1,iz+1),h(ix+1,iy+1,iz+1),ux),uy),uz);
}
function fbm(x: number, y: number, z: number, o = 3): number {
  let v=0, a=0.5, f=1;
  for(let i=0;i<o;i++){ v+=a*vnoise(x*f,y*f,z*f); a*=0.5; f*=2; }
  return v;
}

const BG = [12, 14, 20] as const;

// ── Particles ─────────────────────────────────────────────────────────────────
interface P {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  tier: 0 | 1 | 2; // 0=dust, 1=gas, 2=star
}

const N = 3500;

function spawn(): P {
  const r = Math.cbrt(Math.random()) * 2.0;
  const θ = Math.random() * Math.PI * 2;
  const φ = Math.acos(2 * Math.random() - 1);
  const roll = Math.random();
  const tier: 0 | 1 | 2 = roll < 0.80 ? 0 : roll < 0.95 ? 1 : 2;
  return {
    x: r * Math.sin(φ) * Math.cos(θ),
    y: r * Math.sin(φ) * Math.sin(θ),
    z: r * Math.cos(φ),
    vx: 0, vy: 0, vz: 0,
    tier,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props { scrollYProgress: MotionValue<number>; }

export function HeroNebula({ scrollYProgress }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef  = useRef({ x: -9999, y: -9999 });
  const rafRef    = useRef<number>(0);
  const scrollRef = useRef(0);
  const tRef      = useRef(0);
  // particles live in a ref so they survive re-renders without becoming stale
  const psRef     = useRef<P[]>(Array.from({ length: N }, spawn));

  useEffect(() => scrollYProgress.on("change", v => { scrollRef.current = v; }), [scrollYProgress]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext("2d")!;
    let W = 0, H = 0;
    const ps = psRef.current;

    const resize = () => { W = canvas.width = canvas.offsetWidth; H = canvas.height = canvas.offsetHeight; };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const onMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", () => { mouseRef.current = { x: -9999, y: -9999 }; });

    const FL = 480;

    function project(px: number, py: number, pz: number) {
      const dz = pz + 4.0;
      if (dz <= 0.01) return null;
      const s = FL / dz;
      return { sx: W * 0.5 + px * s, sy: H * 0.46 - py * s, s };
    }

    function draw() {
      rafRef.current = requestAnimationFrame(draw);
      tRef.current += 0.0025;
      const t = tRef.current;
      const { x: mX, y: mY } = mouseRef.current;
      const rotY = scrollRef.current * 1.2;

      // Trail — partial clear
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = `rgba(${BG[0]},${BG[1]},${BG[2]},0.12)`;
      ctx.fillRect(0, 0, W, H);

      // ── Physics ──────────────────────────────────────────────────────────────
      for (const p of ps) {
        const S = 0.5;
        const fnx = (fbm(p.x*S + t*0.28,  p.y*S + 1.73,          p.z*S + 3.14, 3) - 0.5) * 2;
        const fny = (fbm(p.x*S + 7.31,    p.y*S + t*0.28 + 2.11, p.z*S + 0.53, 3) - 0.5) * 2;
        const fnz = (fbm(p.x*S + 4.12,    p.y*S + 1.09,          p.z*S + t*0.28 + 6.21, 3) - 0.5) * 2;

        p.vx += fnx * 0.0016;
        p.vy += fny * 0.0016;
        p.vz += fnz * 0.0011;

        // Central gravity — keeps cloud coherent
        const d = Math.sqrt(p.x*p.x + p.y*p.y + p.z*p.z);
        if (d > 0.5) {
          const g = Math.max(0, d - 0.5) * 0.0005;
          p.vx -= p.x * g;
          p.vy -= p.y * g;
          p.vz -= p.z * g;
        }

        p.vx *= 0.965; p.vy *= 0.965; p.vz *= 0.965;
        p.x += p.vx;   p.y += p.vy;   p.z += p.vz;

        // Scroll Y-rotation
        const cosR = Math.cos(rotY * 0.008);
        const sinR = Math.sin(rotY * 0.008);
        const nx = p.x * cosR - p.z * sinR;
        const nz = p.x * sinR + p.z * cosR;
        p.x = nx; p.z = nz;

        // Respawn escaped particles
        if (d > 3.2) { const np = spawn(); Object.assign(p, np, { vx:0, vy:0, vz:0 }); }
      }

      // ── Draw — additive blend ─────────────────────────────────────────────────
      ctx.globalCompositeOperation = "lighter";

      for (const p of ps) {
        const proj = project(p.x, p.y, p.z);
        if (!proj) continue;
        const { sx, sy, s } = proj;
        if (sx < -100 || sx > W+100 || sy < -100 || sy > H+100) continue;

        // Mouse gravity well (screen space)
        if (mX > 0) {
          const dx = mX - sx, dy = mY - sy;
          const md = Math.sqrt(dx*dx + dy*dy);
          if (md < 220 && md > 1) {
            const str = (1 - md/220) ** 2 * 0.0006;
            p.vx += (dx/md) * str;
            p.vy -= (dy/md) * str;
          }
        }

        // Depth → color (0=far/blue, 1=near/bone)
        const depthT = Math.max(0, Math.min(1, (p.z + 4.0) / 5.0));
        let r: number, g: number, b: number;
        if (depthT < 0.38) {
          const t2 = depthT / 0.38;
          r = Math.round(26  + (58  - 26)  * t2);
          g = Math.round(64  + (134 - 64)  * t2);
          b = Math.round(102 + (214 - 102) * t2);
        } else {
          const t2 = (depthT - 0.38) / 0.62;
          r = Math.round(58  + (221 - 58)  * t2);
          g = Math.round(134 + (213 - 134) * t2);
          b = Math.round(214 + (192 - 214) * t2);
        }

        // Tier → size + alpha
        const [baseSize, baseAlpha] =
          p.tier === 2 ? [0.034, 0.88] :
          p.tier === 1 ? [0.017, 0.52] :
                         [0.008, 0.32];

        const sz = Math.max(0.35, s * baseSize);
        const alpha = baseAlpha * depthT;
        if (alpha < 0.02) continue;

        // Soft halo
        ctx.fillStyle = `rgba(${r},${g},${b},${(alpha * 0.06).toFixed(4)})`;
        ctx.beginPath(); ctx.arc(sx, sy, sz * 7, 0, Math.PI*2); ctx.fill();

        // Core dot
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(4)})`;
        ctx.beginPath(); ctx.arc(sx, sy, sz, 0, Math.PI*2); ctx.fill();
      }

      // ── Post-processing ───────────────────────────────────────────────────────
      ctx.globalCompositeOperation = "screen";
      {
        const cg = ctx.createRadialGradient(W*0.5, H*0.46, 0, W*0.5, H*0.46, W*0.38);
        cg.addColorStop(0, "rgba(58,134,214,0.06)");
        cg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = cg; ctx.fillRect(0,0,W,H);
      }

      ctx.globalCompositeOperation = "source-over";

      // Bottom dissolve into page background
      {
        const gd = ctx.createLinearGradient(0, H*0.52, 0, H);
        gd.addColorStop(0, "rgba(0,0,0,0)");
        gd.addColorStop(1, `rgba(${BG[0]},${BG[1]},${BG[2]},1)`);
        ctx.fillStyle = gd; ctx.fillRect(0,0,W,H);
      }

      // Edge vignette
      {
        const vig = ctx.createRadialGradient(W/2, H/2, W*0.25, W/2, H/2, W*0.78);
        vig.addColorStop(0, "rgba(0,0,0,0)");
        vig.addColorStop(1, `rgba(${BG[0]},${BG[1]},${BG[2]},0.8)`);
        ctx.fillStyle = vig; ctx.fillRect(0,0,W,H);
      }
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
