import { useEffect, useRef, useState } from "react";

// ── Noise ─────────────────────────────────────────────────────────────────────
const _hs = (n: number) => { const x = Math.sin(n) * 43758.5453; return x - Math.floor(x); };
function vnoise2(x: number, y: number): number {
  const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
  const ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy);
  const h=(a:number,b:number)=>_hs(a+b*57.3);
  const lr=(a:number,b:number,t:number)=>a+t*(b-a);
  return lr(lr(h(ix,iy),h(ix+1,iy),ux),lr(h(ix,iy+1),h(ix+1,iy+1),ux),uy);
}
function fbm2(x: number, y: number, o = 3): number {
  let v=0,a=0.5,f=1;
  for(let i=0;i<o;i++){v+=a*vnoise2(x*f,y*f);a*=0.5;f*=2;}
  return v;
}

// ── Cloth constants ───────────────────────────────────────────────────────────
const COLS = 60;
const ROWS = 28;
const GRAVITY  = 0.22;
const DAMPING  = 0.985;
const ITER     = 6;
const MOUSE_R  = 90;
const TEAR_MULT = 1.5;
const T_SETTLE  = 1.2;
const T_ATTRACT = 2.8;

// ── HUD ───────────────────────────────────────────────────────────────────────
const HUD_KEY = "lab2-hud-v2";
interface HudVals {
  waveIntensity: number; // 0–1
  waveSpeed:     number; // 0.5–4
  waveAngle:     number; // 0–360 deg
  brightness:    number; // 0.3–1.5
}
const HUD_DEF: HudVals = { waveIntensity: 0.35, waveSpeed: 2.2, waveAngle: 0, brightness: 1.0 };
function loadHud(): HudVals {
  try {
    const s = localStorage.getItem(HUD_KEY);
    return s ? { ...HUD_DEF, ...JSON.parse(s) } : HUD_DEF;
  } catch { return HUD_DEF; }
}

// ── Interfaces ────────────────────────────────────────────────────────────────
interface Pt {
  x: number; y: number;
  px: number; py: number;
  pinned: boolean;
  lx: number; ly: number; ld: number;
  ix: number; iy: number;   // posizione GRIGLIA (invariante, usata per assignTargets)
  heat: number;
  dissolveDelay: number;
  letterDelay: number;      // stagger individuale per attrazione lettera (come HeroGridNebula)
}
interface Seg { a: number; b: number; rest: number; on: boolean; ten: number; }

// ── build ─────────────────────────────────────────────────────────────────────
// scatter=true: nodi partono sparsi (nube); rest distances sempre da griglia
function build(W: number, H: number, scatter = false) {
  const sx = W / (COLS - 1);
  const sy = (H * 0.65) / (ROWS - 1);
  const oy = H * 0.05;

  const pts: Pt[] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const gx = c * sx, gy = oy + r * sy;
      pts.push({
        x: gx, y: gy, px: gx, py: gy,
        pinned: r === 0 && c % 3 === 0,
        lx: gx, ly: gy, ld: Infinity,
        ix: gx, iy: gy,  // griglia: NON aggiornare in scatter
        heat: 0, dissolveDelay: 0,
        letterDelay: Math.random() * 0.35,
      });
    }

  // Rest distances dalla griglia (prima del scatter)
  const segs: Seg[] = [];
  const addSeg = (a: number, b: number) => {
    const d = Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y);
    segs.push({ a, b, rest: d, on: true, ten: 0 });
  };
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      if (c < COLS - 1) addSeg(i, i + 1);
      if (r < ROWS - 1) addSeg(i, i + COLS);
    }

  // Scatter posizioni (ix/iy restano a griglia per assignTargets)
  if (scatter) {
    for (const p of pts) {
      if (p.pinned) continue;
      p.x  = W * 0.5 + (Math.random() - 0.5) * W * 0.74;
      p.y  = H * 0.42 + (Math.random() - 0.5) * H * 0.52;
      p.px = p.x; p.py = p.y;
      // ix/iy INVARIATI: restano a griglia
    }
  }

  return { pts, segs };
}

// ── sampleLetters — legge dall'h1 DOM reale (come HeroGridNebula) ─────────────
async function sampleLetters(
  canvas: HTMLCanvasElement, W: number, H: number
): Promise<{ x: number; y: number }[]> {
  await document.fonts.ready;
  await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  const h1El = document.querySelector("h1");
  if (!h1El || !W || !H) return [];

  const cs         = getComputedStyle(h1El);
  const fontSize   = parseFloat(cs.fontSize) || 80;
  const fontFamily = cs.fontFamily || "serif";
  const ls         = parseFloat(cs.letterSpacing) || 0;

  const h1Rect  = h1El.getBoundingClientRect();
  const cvRect  = canvas.getBoundingClientRect();
  const padLeft = h1Rect.left - cvRect.left;
  const baseY1  = h1Rect.top  - cvRect.top + fontSize * 0.82;
  const baseY2  = baseY1 + fontSize * 0.88;

  const oc = document.createElement("canvas");
  oc.width = W; oc.height = H;
  const ox = oc.getContext("2d")!;
  ox.fillStyle = "#fff";
  ox.font = `italic ${fontSize}px ${fontFamily}`;
  ox.textAlign = "left";
  ox.textBaseline = "alphabetic";
  if ("letterSpacing" in ox) (ox as unknown as Record<string,string>).letterSpacing = `${(isNaN(ls) ? fontSize * 0.04 : ls).toFixed(1)}px`;
  ox.fillText("Industrial", padLeft, baseY1);
  ox.fillText("Magic",      padLeft, baseY2);

  const d    = ox.getImageData(0, 0, W, H).data;
  const out: { x: number; y: number }[] = [];
  const step = 5;
  for (let y = 0; y < H; y += step)
    for (let x = 0; x < W; x += step)
      if (d[(y * W + x) * 4 + 3] > 100) out.push({ x, y });
  return out;
}

// ── assignTargets — usa ix/iy (posizione griglia) per distanza ────────────────
function assignTargets(pts: Pt[], lp: { x: number; y: number }[]) {
  if (!lp.length) return;
  for (const p of pts) {
    if (p.pinned) continue;
    let minD = Infinity, nx = p.ix, ny = p.iy;
    for (const q of lp) {
      const d = Math.hypot(p.ix - q.x, p.iy - q.y);  // GRID position
      if (d < minD) { minD = d; nx = q.x; ny = q.y; }
    }
    p.lx = nx; p.ly = ny; p.ld = minD;
  }
}

// ── SliderRow ─────────────────────────────────────────────────────────────────
function SliderRow({ label, value, min, max, step, onChange, unit = "" }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; unit?: string;
}) {
  return (
    <div className="mb-3">
      <div className="flex justify-between text-[9px] tracking-wider uppercase text-white/35 mb-1.5">
        <span>{label}</span>
        <span className="text-white/55">{value.toFixed(step < 1 ? 2 : 0)}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-[2px] bg-white/15 appearance-none cursor-pointer accent-white/60
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5
          [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-white/70
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer
          [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:bg-white/70 [&::-moz-range-thumb]:border-0"
      />
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export function ClothDemo2() {
  const cvs = useRef<HTMLCanvasElement>(null);
  const mou = useRef({ x: -9999, y: -9999, down: false });
  const raf = useRef<number>(0);

  // HUD
  const [hudOpen, setHudOpen] = useState(false);
  const [hud, setHud]         = useState<HudVals>(loadHud);
  const hudRef                = useRef<HudVals>(hud);
  useEffect(() => { hudRef.current = hud; }, [hud]);
  const updateHud = (k: keyof HudVals, v: number) => setHud(p => ({ ...p, [k]: v }));
  const saveHud   = () => localStorage.setItem(HUD_KEY, JSON.stringify(hudRef.current));

  useEffect(() => {
    const canvas = cvs.current!;
    const ctx    = canvas.getContext("2d")!;
    let W = 0, H = 0;
    let mouseR = MOUSE_R; // adattivo: 50% su mobile
    let pts: Pt[] = [], segs: Seg[] = [];
    let t0: number | null = null;
    let ready = false;
    let letterPixels: { x: number; y: number }[] = [];
    let tAnim = 0;

    // Water offscreen
    const WW = 240, WH = 135;
    const wCanvas = document.createElement("canvas");
    wCanvas.width = WW; wCanvas.height = WH;
    const wCtx    = wCanvas.getContext("2d")!;
    const wData   = wCtx.createImageData(WW, WH);

    function drawWater(alpha: number) {
      if (alpha <= 0.01) return;
      const d = wData.data, t = tAnim;
      for (let py = 0; py < WH; py++) {
        for (let px = 0; px < WW; px++) {
          const nx = px / WW * 3.2, ny = py / WH * 1.8;
          const w1 = fbm2(nx + t * 0.055, ny + 0.5 + t * 0.038, 4);
          const w2 = fbm2(nx * 0.55 + 4.1 - t * 0.041, ny * 0.75 + 2.3 + t * 0.049, 4);
          const sh = Math.max(0, vnoise2(nx * 2.1 + t * 0.09, ny * 2.3 + 6.1 - t * 0.07) - 0.62) * 2.8;
          const h  = Math.max(0, Math.min(1, w1 * 0.55 + w2 * 0.45));
          let r: number, g: number, b: number;
          if (h < 0.5) { const f = h*2; r=Math.round(8+32*f); g=Math.round(22+68*f); b=Math.round(55+90*f); }
          else { const f=(h-0.5)*2; r=Math.round(40+30*f+sh*60); g=Math.round(90+70*f+sh*80); b=Math.round(145+65*f+sh*60); }
          const idx=(py*WW+px)*4;
          d[idx]=Math.min(255,r); d[idx+1]=Math.min(255,g); d[idx+2]=Math.min(255,b); d[idx+3]=255;
        }
      }
      wCtx.putImageData(wData, 0, 0);
      ctx.globalAlpha = alpha;
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      ctx.drawImage(wCanvas, 0, 0, W, H);
      ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = false;
    }

    // Dissolve state
    let dissolveTriggered = false, dissolveExploding = false;
    let dissolveOriginX = 0, dissolveOriginY = 0, dissolveT = 0;
    let gridEntryT   = -1;
    let phase2StartT = -1;  // per constraint ramp
    let lastMouseT   = -99999;

    // Closure vars per render()
    let curPhase = 0, curAt = 0, curWaveAmp = 0;

    const reconstruct = (ts: number) => {
      const d = build(W, H);
      pts = d.pts; segs = d.segs;
      assignTargets(pts, letterPixels);
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const p = pts[r * COLS + c];
          if (p.pinned) continue;
          const upV = 1.5 + (r / (ROWS - 1)) * 10;
          p.py = p.y + upV;
          p.px = p.x + (Math.random() - 0.5) * 1.5;
        }
      }
      dissolveTriggered = false; dissolveExploding = false;
      dissolveT = 0; gridEntryT = -1; phase2StartT = -1;
      // Salta intro (fase 0/1) e va diretto a fase 2 con animazione onda
      t0 = ts - (T_SETTLE + T_ATTRACT) * 1000;
    };

    const resize = () => {
      W = canvas.offsetWidth; H = canvas.offsetHeight;
      mouseR = W < 768 ? MOUSE_R * 0.5 : MOUSE_R;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const d = build(W, H, true); pts = d.pts; segs = d.segs;
      ready = false; t0 = null; letterPixels = [];
      dissolveTriggered = false; dissolveExploding = false;
      dissolveT = 0; gridEntryT = -1; phase2StartT = -1;
      sampleLetters(canvas, W, H).then(lp => {
        letterPixels = lp;
        assignTargets(pts, lp);
        ready = true;
      });
    };
    resize();
    window.addEventListener("resize", resize);

    const getPos = (e: MouseEvent | Touch) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const mm = (e: MouseEvent) => { Object.assign(mou.current, getPos(e)); lastMouseT = performance.now(); };
    const md = (e: MouseEvent) => { mou.current.down = true; mm(e); };
    const mu = () => { mou.current.down = false; };
    window.addEventListener("mousemove", mm);
    canvas.addEventListener("mousedown", md);
    window.addEventListener("mouseup", mu);
    canvas.addEventListener("touchmove", e => {
      e.preventDefault();
      const p = getPos(e.touches[0]);
      mou.current.x = p.x; mou.current.y = p.y;
      lastMouseT = performance.now();
    }, { passive: false });
    canvas.addEventListener("touchstart", e => {
      e.preventDefault(); // evita double-tap zoom su iOS
      mou.current.down = true;
      const p = getPos(e.touches[0]);
      mou.current.x = p.x; mou.current.y = p.y;
      lastMouseT = performance.now();
    }, { passive: false });
    canvas.addEventListener("touchend", () => { mou.current.down = false; });

    let lastTs = 0;

    function frame(ts: number) {
      raf.current = requestAnimationFrame(frame);
      if (t0 === null) t0 = ts;
      const dt = Math.min((ts - lastTs) / 1000, 0.05);
      lastTs = ts;
      tAnim += 0.011;
      const el = (ts - t0) / 1000;
      const { x: mx, y: my, down } = mou.current;

      const phase = el < T_SETTLE ? 0 : el < T_SETTLE + T_ATTRACT ? 1 : 2;
      const at    = phase > 0 ? Math.min(1, (el - T_SETTLE) / T_ATTRACT) : 0;

      // Constraint ramp solo in fase 2 (fase 0/1 gestite da fbm2 drift)
      if (phase === 2 && phase2StartT < 0) phase2StartT = ts;
      const phase2Age      = phase2StartT >= 0 ? (ts - phase2StartT) / 1000 : 0;
      const constraintRamp = phase === 2 ? Math.min(1, phase2Age / 1.5) : 0;

      // Idle wave
      const idleMs  = phase === 2 && !dissolveTriggered ? Math.max(0, ts - lastMouseT - 2000) : 0;
      const waveAmp = Math.min(1, idleMs / 2000);

      curPhase = phase; curAt = at; curWaveAmp = waveAmp;

      // ── Dissolve physics ────────────────────────────────────────────────
      if (dissolveTriggered) {
        dissolveT += dt;
        if (!dissolveExploding) {
          for (const p of pts) {
            if (p.pinned) continue;
            if (dissolveT < p.dissolveDelay) {
              p.x += (Math.sin(p.ix * 13.7 + dissolveT * 4.2) - 0.5) * 3.5;
              p.y += (Math.sin(p.iy * 19.3 + dissolveT * 3.8 + 2.1) - 0.5) * 3.5;
            } else {
              const odx = p.x - dissolveOriginX, ody = p.y - dissolveOriginY;
              const olen = Math.hypot(odx, ody) + 0.5;
              p.x += (odx / olen) * 0.55; p.y += (ody / olen) * 0.55;
              p.heat = Math.min(1, p.heat + 0.005);
            }
          }
        }
        for (const p of pts) {
          if (p.pinned) continue;
          const vx = (p.x - p.px) * DAMPING, vy = (p.y - p.py) * DAMPING;
          p.px = p.x; p.py = p.y; p.x += vx; p.y += vy; p.heat *= 0.985;
        }
        if (!dissolveExploding && dissolveT >= 2.2) {
          dissolveExploding = true;
          for (const p of pts) {
            if (p.pinned) continue;
            const odx = p.x - dissolveOriginX, ody = p.y - dissolveOriginY;
            const olen = Math.hypot(odx, ody) + 0.5;
            const str = 4.5 + Math.random() * 3.0;
            p.px -= (odx / olen) * str + (Math.random() - 0.5) * 2.0;
            p.py -= (ody / olen) * str + (Math.random() - 0.5) * 2.0;
          }
        }
        if (dissolveExploding && dissolveT >= 6.0) reconstruct(lastTs);
        render(0.055, true, 0.10);
        return;
      }

      // ── Physics — split per fase (come HeroGridNebula) ──────────────────
      if (phase === 0) {
        // Float: fbm2 drift organico, no gravity, no constraints, boundary soft
        for (const p of pts) {
          if (p.pinned) continue;
          const nx = p.x / W, ny = p.y / H;
          const S  = 0.5;
          const fnx = (fbm2(nx * S + tAnim * 0.24, ny * S + 1.73) - 0.5) * 2;
          const fny = (fbm2(nx * S + 7.31, ny * S + tAnim * 0.24 + 2.11) - 0.5) * 2;
          const vx  = (p.x - p.px) * 0.968 + fnx * 1.1;
          const vy  = (p.y - p.py) * 0.968 + fny * 0.8;
          p.px = p.x; p.py = p.y;
          p.x += vx; p.y += vy;
          // Soft boundary: mantieni nodi nell'area centrale
          const bdx = p.x - W * 0.5, bdy = p.y - H * 0.40;
          const dN  = Math.hypot(bdx / W, bdy / H);
          if (dN > 0.44) { const g = (dN - 0.44) * 0.022; p.x -= bdx * g; p.y -= bdy * g; }
        }

      } else if (phase === 1) {
        // Letter formation: staggered per-nodo, drift per non-lettera
        for (const p of pts) {
          if (p.pinned) continue;
          const nx = p.x / W, ny = p.y / H;
          const S  = 0.5;
          if (p.ld < 50 && ready) {
            const localT = Math.max(0, (at - p.letterDelay) / Math.max(0.01, 1 - p.letterDelay));
            if (localT > 0) {
              const force = localT * localT * 0.17;
              p.x += (p.lx - p.x) * force;
              p.y += (p.ly - p.y) * force;
            } else {
              // ancora in float prima del proprio delay individuale
              p.x += (fbm2(nx * S + tAnim * 0.22, ny * S + 1.73) - 0.5) * 2 * 0.85;
              p.y += (fbm2(nx * S + 7.31, ny * S + tAnim * 0.22 + 2.11) - 0.5) * 2 * 0.65;
            }
          } else {
            // Non-lettera: drift più lento + lieve discesa
            p.x += (fbm2(nx * S + tAnim * 0.24, ny * S + 1.73) - 0.5) * 2 * 0.55;
            p.y += (fbm2(nx * S + 7.31, ny * S + tAnim * 0.24 + 2.11) - 0.5) * 2 * 0.40;
            p.y += 0.08; // lieve discesa
          }
          const vx = (p.x - p.px) * 0.88;
          const vy = (p.y - p.py) * 0.88;
          p.px = p.x; p.py = p.y;
          p.x += vx; p.y += vy;
        }

      } else {
        // Fase 2: fisica cloth completa (gravity, mouse, constraints)
        for (const p of pts) {
          if (p.pinned) continue;
          const vx = (p.x - p.px) * DAMPING, vy = (p.y - p.py) * DAMPING;
          p.px = p.x; p.py = p.y;
          p.x += vx; p.y += vy + GRAVITY;

          // Mouse
          const ddx = p.x - mx, ddy = p.y - my;
          const md2 = Math.sqrt(ddx * ddx + ddy * ddy);
          if (md2 < mouseR) {
            const prox = 1 - md2 / mouseR;
            if (down) {
              p.x += (mx - p.x) * prox * 0.75;
              p.y += (my - p.y) * prox * 0.75;
            } else {
              const inv = 1 / (md2 || 0.001);
              p.x += ddx * inv * prox * 1.8;
              p.y += ddy * inv * prox * 1.8;
            }
            p.heat = Math.min(1, p.heat + prox * 0.12);
          } else {
            p.heat *= 0.94;
          }
        }
      }

      // ── Tear (solo fase 2) ───────────────────────────────────────────────
      if (phase === 2) {
        for (const s of segs) {
          if (!s.on) continue;
          const pa = pts[s.a], pb = pts[s.b];
          const dist = Math.hypot(pa.x - pb.x, pa.y - pb.y);
          const tear = s.rest * TEAR_MULT;
          s.ten = Math.max(0, Math.min(1, (dist - s.rest) / (tear - s.rest)));
          if (dist > tear) { s.on = false; continue; }
          if (down) {
            const cmx = (pa.x + pb.x) * 0.5, cmy = (pa.y + pb.y) * 0.5;
            if (Math.hypot(cmx - mx, cmy - my) < 18) s.on = false;
          }
        }
      }

      // ── Constraints (con ramp) ───────────────────────────────────────────
      if (constraintRamp > 0) {
        for (let it = 0; it < ITER; it++) {
          for (const s of segs) {
            if (!s.on) continue;
            const pa = pts[s.a], pb = pts[s.b];
            const ddx = pa.x - pb.x, ddy = pa.y - pb.y;
            const dist = Math.sqrt(ddx * ddx + ddy * ddy) || 0.001;
            const tear = s.rest * TEAR_MULT;
            s.ten = Math.max(0, Math.min(1, (dist - s.rest) / (tear - s.rest)));
            if (dist > tear && phase === 2 && constraintRamp > 0.8) { s.on = false; continue; }
            const diff = (dist - s.rest) / dist * 0.5 * constraintRamp;
            const ox = ddx * diff, oy = ddy * diff;
            if (!pa.pinned) { pa.x -= ox; pa.y -= oy; }
            if (!pb.pinned) { pb.x += ox; pb.y += oy; }
          }
        }
      }

      // ── Off-screen → reconstruct ─────────────────────────────────────────
      if (phase === 2 && ready && !dissolveTriggered) {
        let offScreen = 0, unpinned = 0;
        for (const p of pts) { if (!p.pinned) { unpinned++; if (p.y > H * 1.25) offScreen++; } }
        if (unpinned > 0 && offScreen / unpinned >= 0.70) reconstruct(lastTs);
      }

      // ── Dissolve trigger ─────────────────────────────────────────────────
      if (phase === 2 && ready && !dissolveTriggered) {
        let broken = 0;
        for (const s of segs) if (!s.on) broken++;
        if (broken / segs.length >= 0.45) {
          dissolveTriggered = true; dissolveT = 0;
          let hcx = 0, hcy = 0, hc = 0;
          for (const p of pts) { if (!p.pinned && p.heat > 0.2) { hcx+=p.x; hcy+=p.y; hc++; } }
          dissolveOriginX = hc > 0 ? hcx / hc : W * 0.5;
          dissolveOriginY = hc > 0 ? hcy / hc : H * 0.45;
          const maxD = Math.hypot(W, H);
          for (const p of pts) {
            p.px = p.x; p.py = p.y; p.ix = p.x; p.iy = p.y;
            p.dissolveDelay = Math.hypot(p.x - dissolveOriginX, p.y - dissolveOriginY) / maxD * 1.5;
          }
        }
      }

      if (phase === 2 && gridEntryT < 0 && !dissolveTriggered) gridEntryT = ts;
      if (dissolveTriggered || phase < 2) gridEntryT = -1;
      const gridAge   = gridEntryT >= 0 ? (ts - gridEntryT) / 1000 : 0;
      const clearAlpha = phase === 0 ? 0.65 : phase === 1 ? 0.72 : 0.72 + 0.23 * Math.min(1, gridAge / 1.5);
      const waterAlpha = phase === 0 ? 0 : phase === 1 ? Math.min(1, (el - T_SETTLE) / T_ATTRACT) * 0.18 : 0.18;

      render(clearAlpha, false, waterAlpha);
    }

    function render(clearAlpha: number, inDissolve: boolean, waterAlpha: number) {
      const ph  = inDissolve ? 2 : curPhase;
      const at  = inDissolve ? 1 : curAt;
      const wav = inDissolve ? 0 : curWaveAmp;
      const { waveIntensity, waveSpeed, waveAngle, brightness } = hudRef.current;

      ctx.fillStyle = `rgba(11,13,20,${clearAlpha.toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
      drawWater(waterAlpha);
      ctx.lineCap = "round";

      // Visibilità: fase 0 = solo dots, fase 1 = crossfade, fase 2 = linee
      const lineVis = ph === 0 ? 0 : ph === 1 ? Math.min(1, at * 1.8) : 1;
      const dotVis  = ph === 0 ? 1 : ph === 1 ? Math.max(0, 1 - at * 2.2) : 0;

      // ── Dot render (nube particelle — fase 0 e inizio fase 1) ─────────────
      if (dotVis > 0.01) {
        for (const p of pts) {
          if (p.pinned) continue;
          const nearLetter = p.ld < 28 && at > 0.05 ? Math.min(1, (at - 0.05) / 0.4) : 0;
          const dotA = dotVis * (0.32 + nearLetter * 0.52) * brightness;
          const dotR = 1.2 + nearLetter * 1.2;
          const rc = Math.round(80  + nearLetter * 130);
          const gc = Math.round(170 + nearLetter * 65);
          ctx.beginPath(); ctx.arc(p.x, p.y, dotR, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${rc},${gc},255,${dotA.toFixed(3)})`; ctx.fill();
          if (dotA > 0.2) {
            ctx.beginPath(); ctx.arc(p.x, p.y, dotR * 3.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(80,170,255,${(dotA * 0.07).toFixed(3)})`; ctx.fill();
          }
        }
      }

      // ── Segment render ────────────────────────────────────────────────────
      if (lineVis > 0.01) {
        const wAngleRad = (waveAngle * Math.PI) / 180;
        const wDirX = Math.cos(wAngleRad), wDirY = Math.sin(wAngleRad);

        // Glow pre-pass ampia (batch)
        ctx.beginPath();
        for (const s of segs) {
          if (!s.on) continue;
          if (inDissolve) {
            const pa=pts[s.a], pb=pts[s.b];
            const fA=Math.max(0,1-Math.hypot(pa.x-pa.ix,pa.y-pa.iy)/180);
            const fB=Math.max(0,1-Math.hypot(pb.x-pb.ix,pb.y-pb.iy)/180);
            if (fA*fB < 0.02) continue;
          }
          ctx.moveTo(pts[s.a].x, pts[s.a].y);
          ctx.lineTo(pts[s.b].x, pts[s.b].y);
        }
        ctx.strokeStyle = `rgba(60,150,255,${(0.05 * lineVis * brightness).toFixed(3)})`;
        ctx.lineWidth = 9; ctx.stroke();

        // Glow pre-pass interna
        ctx.beginPath();
        for (const s of segs) {
          if (!s.on) continue;
          ctx.moveTo(pts[s.a].x, pts[s.a].y); ctx.lineTo(pts[s.b].x, pts[s.b].y);
        }
        ctx.strokeStyle = `rgba(90,180,255,${(0.10 * lineVis * brightness).toFixed(3)})`;
        ctx.lineWidth = 3; ctx.stroke();

        // Per-segment: colore + onda idle
        for (const s of segs) {
          if (!s.on) continue;
          const pa = pts[s.a], pb = pts[s.b];
          const h = Math.max(s.ten, (pa.heat + pb.heat) * 0.5);

          let dissolveFade = 1;
          if (inDissolve) {
            const fA = Math.max(0, 1 - Math.hypot(pa.x-pa.ix, pa.y-pa.iy) / 180);
            const fB = Math.max(0, 1 - Math.hypot(pb.x-pb.ix, pb.y-pb.iy) / 180);
            dissolveFade = fA * fB;
            if (dissolveFade < 0.02) continue;
          }

          // Onda idle direzionale
          let effH = h;
          if (wav > 0.01 && waveIntensity > 0.01) {
            const midX = (pa.x + pb.x) * 0.5;
            const midY = (pa.y + pb.y) * 0.5;
            const proj    = (midX / W) * wDirX + (midY / H) * wDirY;
            const waveRaw = Math.sin(proj * Math.PI * 5.0 - tAnim * waveSpeed);
            effH = Math.min(1, h + Math.max(0, waveRaw) * wav * waveIntensity * 0.55);
          }

          let r: number, g: number, b: number;
          if (effH > 0.72) {
            const f = (effH - 0.72) / 0.28;
            r = 255; g = Math.round(210 + (255-210)*f); b = Math.round(255*f);
          } else if (effH > 0.38) {
            const f = (effH - 0.38) / 0.34;
            r = 230; g = Math.round(40 + (210-40)*f); b = 0;
          } else if (effH > 0.12) {
            const f = (effH - 0.12) / 0.26;
            r = Math.round(90 + (230-90)*f); g = Math.round(185*(1-f)); b = Math.round(255*(1-f));
          } else {
            r = 90; g = 185; b = 255;
          }

          const alpha = (0.62 + effH * 0.34) * dissolveFade * lineVis * brightness;
          const lw    = 0.5 + effH * 1.9;

          if (effH > 0.45) {
            ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
            ctx.strokeStyle = `rgba(${r},${g},${b},${(alpha * 0.15 * dissolveFade).toFixed(3)})`;
            ctx.lineWidth = lw * 4.5; ctx.stroke();
          }
          ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
          ctx.strokeStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
          ctx.lineWidth = lw; ctx.stroke();
        }
      }

      // Pin dots
      if (!inDissolve && ph === 2) {
        for (const p of pts) {
          if (!p.pinned) continue;
          ctx.fillStyle = "rgba(90,185,255,0.55)";
          ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI*2); ctx.fill();
        }
      }

      // Cursore
      const { x: cmx, y: cmy } = mou.current;
      if (!inDissolve && ph === 2 && cmx >= 0 && cmx <= W && cmy >= 0 && cmy <= H) {
        ctx.beginPath(); ctx.arc(cmx, cmy, mouseR, 0, Math.PI*2);
        ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 1; ctx.stroke();
        ctx.beginPath(); ctx.arc(cmx, cmy, 2.5, 0, Math.PI*2);
        ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.fill();
      }

      // Gradiente + vignette
      const gd = ctx.createLinearGradient(0, H*0.65, 0, H);
      gd.addColorStop(0, "rgba(0,0,0,0)"); gd.addColorStop(1, "rgba(11,13,20,1)");
      ctx.fillStyle = gd; ctx.fillRect(0, 0, W, H);
      const vig = ctx.createRadialGradient(W*.5, H*.5, W*.18, W*.5, H*.5, W*.82);
      vig.addColorStop(0, "rgba(0,0,0,0)"); vig.addColorStop(1, "rgba(11,13,20,0.72)");
      ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
    }

    raf.current = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", mm);
      window.removeEventListener("mouseup", mu);
    };
  }, []);

  return (
    <>
      <canvas
        ref={cvs}
        className="absolute inset-0 w-full h-full block cursor-none"
        style={{ touchAction: "none" }}
      />

      {/* HUD — fixed per uscire dallo stacking context del canvas */}
      <div className="fixed top-4 right-4 z-[100] pointer-events-auto select-none font-mono">
        <button
          onClick={() => setHudOpen(v => !v)}
          className="text-[9px] tracking-[0.3em] uppercase text-white/30 hover:text-white/60
            border border-white/10 hover:border-white/20 px-4 py-3 backdrop-blur-sm
            bg-black/20 transition-colors w-full text-right min-h-[44px]"
        >
          {hudOpen ? "× close" : "hud"}
        </button>

        {hudOpen && (
          <div className="mt-1 border border-white/10 bg-black/70 backdrop-blur-md p-5 w-52">
            <p className="text-[8px] tracking-[0.35em] uppercase text-white/25 mb-5">
              Wave Controls
            </p>
            <SliderRow label="Intensity"  value={hud.waveIntensity} min={0}   max={1}   step={0.01} onChange={v => updateHud("waveIntensity", v)} />
            <SliderRow label="Speed"      value={hud.waveSpeed}     min={0.5} max={4.0} step={0.05} onChange={v => updateHud("waveSpeed", v)} />
            <SliderRow label="Angle"      value={hud.waveAngle}     min={0}   max={360} step={1}    onChange={v => updateHud("waveAngle", v)} unit="°" />
            <div className="my-4 border-t border-white/10" />
            <p className="text-[8px] tracking-[0.35em] uppercase text-white/25 mb-4">
              Color
            </p>
            <SliderRow label="Brightness" value={hud.brightness}    min={0.3} max={1.5} step={0.01} onChange={v => updateHud("brightness", v)} />
            <button
              onClick={saveHud}
              className="mt-4 w-full text-[8px] tracking-[0.3em] uppercase text-white/50
                hover:text-white/80 border border-white/10 hover:border-white/25
                py-2 transition-colors"
            >
              Save
            </button>
          </div>
        )}
      </div>
    </>
  );
}
