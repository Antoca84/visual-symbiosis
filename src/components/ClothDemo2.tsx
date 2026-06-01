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
const COLS = 60, ROWS = 28;
const GRAVITY = 0.132, DAMPING = 0.985, ITER = 6;
const MOUSE_R = 90, TEAR_MULT = 1.8;
const T_CLOUD = 1.4;   // durata nube float
const T_LETTER = 2.6;  // durata convergenza lettere

// ── Thanos dissolve ───────────────────────────────────────────────────────────
const SWEEP_DUR = 1.6; // secondi per sweep left→right
interface DustParticle {
  x: number; y: number;
  vx: number; vy: number;
  activateAt: number; maxLife: number;
  r: number; g: number; b: number; size: number;
}

// ── Particle cloud (sistema indipendente) ─────────────────────────────────────
const N_PART = 2000;
interface Part {
  x: number; y: number;
  ox: number; oy: number; // posizione frame precedente (per scia)
  vx: number; vy: number;
  lx: number; ly: number;
  ld: number;
  delay: number; // stagger 0–0.40
}

function initParticles(W: number, H: number): Part[] {
  return Array.from({ length: N_PART }, () => {
    const x = Math.random() * W, y = Math.random() * H;
    return { x, y, ox: x, oy: y, vx: (Math.random()-0.5)*0.8, vy: (Math.random()-0.5)*0.8,
      lx: 0, ly: 0, ld: Infinity, delay: Math.random() * 0.40 };
  });
}

function assignPartTargets(parts: Part[], lp: { x: number; y: number }[]) {
  if (!lp.length) return;
  // Distribuzione uniforme: ogni particella → pixel-lettera unico (con tiny jitter)
  const shuffled = [...lp].sort(() => Math.random() - 0.5);
  for (let i = 0; i < parts.length; i++) {
    const q = shuffled[i % shuffled.length];
    const p = parts[i];
    p.lx = q.x + (Math.random() - 0.5) * 2.5;
    p.ly = q.y + (Math.random() - 0.5) * 2.5;
    p.ld = Math.hypot(p.x - p.lx, p.y - p.ly);
  }
}

// ── Cloth (Verlet — la "tenda") ───────────────────────────────────────────────
interface Pt {
  x: number; y: number;
  px: number; py: number;
  pinned: boolean;
  ix: number; iy: number;
  heat: number;
  dissolveDelay: number;
}
interface Seg { a: number; b: number; rest: number; on: boolean; ten: number; }

// curtain=true: nodi non-pinnati partono compressi in alto (si srotolano)
function build(W: number, H: number, curtain = false) {
  const sx = W / (COLS - 1);
  const sy = (H * 0.65) / (ROWS - 1);
  const oy = H * 0.05;

  const pts: Pt[] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const gx = c * sx, gy = oy + r * sy;
      const startY = curtain ? oy : gy; // nodi partono dal pin row → cadono
      pts.push({
        x: gx, y: startY, px: gx, py: startY,
        pinned: r === 0 && c % 3 === 0,
        ix: gx, iy: gy,
        heat: 0, dissolveDelay: 0,
      });
    }

  const segs: Seg[] = [];
  const addSeg = (a: number, b: number) => {
    const pa = pts[a], pb = pts[b];
    const d = Math.hypot(pa.ix - pb.ix, pa.iy - pb.iy); // rest dalla griglia
    segs.push({ a, b, rest: d, on: true, ten: 0 });
  };
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      if (c < COLS - 1) addSeg(i, i + 1);
      if (r < ROWS - 1) addSeg(i, i + COLS);
    }

  return { pts, segs };
}

// ── Sample letters dal DOM h1 reale ──────────────────────────────────────────
async function sampleLetters(
  canvas: HTMLCanvasElement, W: number, H: number
): Promise<{ x: number; y: number }[]> {
  await document.fonts.ready;
  await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const h1El = document.querySelector("h1");
  if (!h1El || !W || !H) return [];

  const cs         = getComputedStyle(h1El);
  const fontFamily = cs.fontFamily || "serif";
  const fontStyle  = cs.fontStyle  || "normal";
  const ls         = parseFloat(cs.letterSpacing) || 0;
  const fontSize   = parseFloat(cs.fontSize) || 80;
  const rawLH      = parseFloat(cs.lineHeight);
  const lineH      = isNaN(rawLH) ? fontSize * 0.85 : rawLH;
  const halfLeading = (lineH - fontSize) / 2;

  const cvRect  = canvas.getBoundingClientRect();
  const h1Rect  = h1El.getBoundingClientRect();
  const padLeft = h1Rect.left - cvRect.left;

  // Offscreen canvas a DPR reale: stessa risoluzione fisica del main canvas.
  // Su Retina (DPR=2) il browser usa subpixel hinting; senza DPR il campionamento
  // diverge dal rendering CSS di qualche px. Dividendo le posizioni campionate per dpr
  // si ottengono coordinate CSS pixel identiche a quelle del main canvas.
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const PW = Math.round(W * dpr), PH = Math.round(H * dpr);
  const oc = document.createElement("canvas");
  oc.width = PW; oc.height = PH;
  const ox = oc.getContext("2d")!;
  ox.setTransform(dpr, 0, 0, dpr, 0, 0);          // coordinate CSS pixel
  ox.font = `${fontStyle} ${fontSize}px ${fontFamily}`;
  ox.textAlign = "left"; ox.textBaseline = "alphabetic";
  if ("letterSpacing" in ox)
    (ox as unknown as Record<string,string>).letterSpacing =
      `${(isNaN(ls) ? fontSize * 0.04 : ls).toFixed(1)}px`;

  // Stesso ascender tipografico per entrambe le righe (come fa CSS)
  const typAscender = ox.measureText("Hd").actualBoundingBoxAscent;
  const baseline1   = h1Rect.top - cvRect.top + halfLeading + typAscender;
  const baseline2   = baseline1 + lineH;

  ox.fillStyle = "#fff";
  ox.fillText("Industrial", padLeft, baseline1);
  ox.fillText("Magic",      padLeft, baseline2);

  // Campiona in coordinate fisiche (PW×PH), converte in CSS pixel (÷dpr)
  const d    = ox.getImageData(0, 0, PW, PH).data;
  const out: { x: number; y: number }[] = [];
  const step = 4;                              // step in CSS pixel
  const ps   = Math.round(step * dpr);         // step in pixel fisici
  for (let py = 0; py < PH; py += ps)
    for (let px = 0; px < PW; px += ps)
      if (d[(py * PW + px) * 4 + 3] > 100)
        out.push({ x: px / dpr, y: py / dpr });
  return out;
}

// ── HUD ───────────────────────────────────────────────────────────────────────
const HUD_KEY = "lab2-hud-v6";
interface HudVals { waveIntensity: number; waveSpeed: number; waveAngle: number; brightness: number; particleGlow: number; trailAlpha: number; trailMult: number; offsetX: number; offsetY: number; }
const HUD_DEF: HudVals = { waveIntensity: 0.35, waveSpeed: 2.2, waveAngle: 0, brightness: 1.0, particleGlow: 1.0, trailAlpha: 0.6, trailMult: 2.5, offsetX: 0, offsetY: 0 };
function loadHud(): HudVals {
  try { const s = localStorage.getItem(HUD_KEY); return s ? { ...HUD_DEF, ...JSON.parse(s) } : HUD_DEF; }
  catch { return HUD_DEF; }
}

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
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-[2px] bg-white/15 appearance-none cursor-pointer accent-white/60
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5
          [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-white/70
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer
          [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:bg-white/70 [&::-moz-range-thumb]:border-0" />
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export function ClothDemo2({ showHud = true }: { showHud?: boolean } = {}) {
  const cvs = useRef<HTMLCanvasElement>(null);
  const mou = useRef({ x: -9999, y: -9999, down: false });
  const raf = useRef<number>(0);
  const [hudOpen, setHudOpen] = useState(false);
  const [hud, setHud]         = useState<HudVals>(loadHud);
  const hudRef                = useRef<HudVals>(hud);
  useEffect(() => { hudRef.current = hud; }, [hud]);
  const updateHud = (k: keyof HudVals, v: number) => setHud(p => ({ ...p, [k]: v }));
  const saveHud   = () => localStorage.setItem(HUD_KEY, JSON.stringify(hudRef.current));

  useEffect(() => {
    const canvas = cvs.current!;
    const ctx    = canvas.getContext("2d")!;
    let W = 0, H = 0, mouseR = MOUSE_R;
    let tAnim = 0;

    // ── Water animata con throttle 3 frame ───────────────────────────────────
    const WW = 240, WH = 135;
    const wCanvas = document.createElement("canvas");
    wCanvas.width = WW; wCanvas.height = WH;
    const wCtx = wCanvas.getContext("2d")!, wData = wCtx.createImageData(WW, WH);

    let waterFrameSkip = 0;
    function drawWater(alpha: number) {
      if (alpha <= 0.01) return;
      if (++waterFrameSkip % 3 === 1) {
        const d = wData.data, t = tAnim;
        for (let py = 0; py < WH; py++) for (let px = 0; px < WW; px++) {
          const nx=px/WW*3.2, ny=py/WH*1.8;
          const w1=fbm2(nx+t*0.055, ny+0.5+t*0.038, 3);
          const w2=fbm2(nx*0.55+4.1-t*0.041, ny*0.75+2.3+t*0.049, 3);
          const sh=Math.max(0,vnoise2(nx*2.1+t*0.09, ny*2.3+6.1-t*0.07)-0.62)*2.8;
          const h=Math.max(0,Math.min(1,w1*0.55+w2*0.45));
          let r:number,g:number,b:number;
          if(h<0.5){const f=h*2;r=Math.round(8+32*f);g=Math.round(22+68*f);b=Math.round(55+90*f);}
          else{const f=(h-0.5)*2;r=Math.round(40+30*f+sh*60);g=Math.round(90+70*f+sh*80);b=Math.round(145+65*f+sh*60);}
          const idx=(py*WW+px)*4;
          d[idx]=Math.min(255,r);d[idx+1]=Math.min(255,g);d[idx+2]=Math.min(255,b);d[idx+3]=255;
        }
        wCtx.putImageData(wData,0,0);
      }
      ctx.globalAlpha=alpha; ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality="high";
      ctx.drawImage(wCanvas,0,0,W,H);
      ctx.globalAlpha=1; ctx.imageSmoothingEnabled=false;
    }

    // ── State ──────────────────────────────────────────────────────────────
    let parts: Part[] = [];
    let pts: Pt[] = [], segs: Seg[] = [];
    let t0: number | null = null;
    let letterPixels: { x: number; y: number }[] = [];
    let lettersReady = false;

    let dissolveTriggered = false, dissolveExploding = false;
    let dissolveOriginX = 0, dissolveOriginY = 0, dissolveT = 0;
    let dissolveMaxR = 1;
    let dustParticles: DustParticle[] = [];
    let gridEntryT = -1, phase2StartT = -1;
    let lastMouseT = -99999;
    let curPhase = 0, curAt = 0, curWaveAmp = 0;
    let cachedGd: CanvasGradient | null = null;
    let cachedVig: CanvasGradient | null = null;

    const reconstruct = (ts: number) => {
      const d = build(W, H); // no curtain: ricostruisce da posizioni normali
      pts = d.pts; segs = d.segs;
      // Onda upward
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const p = pts[r*COLS+c];
        if (p.pinned) continue;
        const upV = 1.5 + (r/(ROWS-1))*10;
        p.py = p.y + upV;
        p.px = p.x + (Math.random()-0.5)*1.5;
      }
      dissolveTriggered = false; dissolveExploding = false;
      dissolveT = 0; gridEntryT = -1; phase2StartT = -1;
      t0 = ts - (T_CLOUD + T_LETTER) * 1000; // salta intro → fase 2 diretto
    };

    const resize = () => {
      W = canvas.offsetWidth; H = canvas.offsetHeight;
      mouseR = W < 768 ? MOUSE_R * 0.5 : MOUSE_R;
      const dpr = Math.min(devicePixelRatio||1, 2);
      canvas.width = W*dpr; canvas.height = H*dpr;
      ctx.setTransform(dpr,0,0,dpr,0,0);
      // Cloth: curtain (nodi compressi in alto, si srotolano in fase 2)
      const d = build(W, H, true); pts = d.pts; segs = d.segs;
      // Particle cloud: scatter iniziale
      parts = initParticles(W, H);
      t0 = null; lettersReady = false; letterPixels = [];
      dissolveTriggered = false; dissolveExploding = false;
      dissolveT = 0; gridEntryT = -1; phase2StartT = -1;
      cachedGd = ctx.createLinearGradient(0, H*0.65, 0, H);
      cachedGd.addColorStop(0, "rgba(0,0,0,0)"); cachedGd.addColorStop(1, "rgba(11,13,20,1)");
      cachedVig = ctx.createRadialGradient(W*.5,H*.5,W*.18,W*.5,H*.5,W*.82);
      cachedVig.addColorStop(0,"rgba(0,0,0,0)"); cachedVig.addColorStop(1,"rgba(11,13,20,0.72)");
      sampleLetters(canvas, W, H).then(lp => {
        letterPixels = lp;
        assignPartTargets(parts, lp);
        lettersReady = true;
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
      mou.current.x = p.x; mou.current.y = p.y; lastMouseT = performance.now();
    }, { passive: false });
    canvas.addEventListener("touchstart", e => {
      e.preventDefault();
      mou.current.down = true;
      const p = getPos(e.touches[0]);
      mou.current.x = p.x; mou.current.y = p.y; lastMouseT = performance.now();
    }, { passive: false });
    canvas.addEventListener("touchend", () => { mou.current.down = false; });

    let lastTs = 0;

    function frame(ts: number) {
      raf.current = requestAnimationFrame(frame);
      if (t0 === null) t0 = ts;
      const dt = Math.min((ts - lastTs) / 1000, 0.05);
      lastTs = ts; tAnim += 0.011;
      const el = (ts - t0) / 1000;
      const { x: mx, y: my, down } = mou.current;

      // Fasi: 0 = nube float, 1 = formazione lettere, 2 = tenda interattiva
      const phase = el < T_CLOUD ? 0 : el < T_CLOUD + T_LETTER ? 1 : 2;
      const at    = phase > 0 ? Math.min(1, (el - T_CLOUD) / T_LETTER) : 0;

      if (phase === 2 && phase2StartT < 0) phase2StartT = ts;
      const phase2Age      = phase2StartT >= 0 ? (ts - phase2StartT) / 1000 : 0;
      const constraintRamp = phase === 2 ? Math.min(1, phase2Age / 2.5) : 0;

      const idleMs  = phase === 2 && !dissolveTriggered ? Math.max(0, ts - lastMouseT - 2000) : 0;
      const waveAmp = Math.min(1, idleMs / 2000);
      curPhase = phase; curAt = at; curWaveAmp = waveAmp;

      // ── Dissolve cloth: Thanos sweep left→right ─────────────────────────
      if (dissolveTriggered) {
        dissolveT += dt;

        // Verlet continua live durante dissolve (cloth ancora fisico)
        for (const p of pts) {
          if (p.pinned) continue;
          const vx=(p.x-p.px)*DAMPING, vy=(p.y-p.py)*DAMPING;
          p.px=p.x; p.py=p.y; p.x+=vx; p.y+=vy+GRAVITY; p.heat*=0.97;
        }
        for (let it=0;it<ITER;it++) {
          for (const s of segs) {
            if (!s.on) continue;
            const pa=pts[s.a],pb=pts[s.b];
            const ddx=pa.x-pb.x,ddy=pa.y-pb.y;
            const dist=Math.sqrt(ddx*ddx+ddy*ddy)||0.001;
            if (dist>s.rest*TEAR_MULT){s.on=false;continue;}
            const diff=(dist-s.rest)/dist*0.5;
            const ox=ddx*diff,oy=ddy*diff;
            if(!pa.pinned){pa.x-=ox;pa.y-=oy;}
            if(!pb.pinned){pb.x+=ox;pb.y+=oy;}
          }
        }

        // Aggiorna dust particles
        for (const dp of dustParticles) {
          if (dissolveT < dp.activateAt) continue;
          dp.vy += 0.06;
          dp.vx *= 0.984; dp.vy *= 0.984;
          dp.x += dp.vx; dp.y += dp.vy;
        }
        const sweepR = (dissolveT / SWEEP_DUR) * dissolveMaxR;
        if (dissolveT > SWEEP_DUR + 1.4) { reconstruct(lastTs); return; }
        renderThanos(sweepR);
        return;
      }

      // ── Particle cloud physics (fasi 0 e 1) ────────────────────────────
      if (phase < 2) {
        const S = 0.5;
        for (const p of parts) {
          const nx = p.x / W, ny = p.y / H;
          if (phase === 0) {
            // Float: fbm2 drift organico (identico HeroGridNebula)
            const fnx = (fbm2(nx*S + tAnim*0.24, ny*S + 1.73) - 0.5) * 2;
            const fny = (fbm2(nx*S + 7.31, ny*S + tAnim*0.24 + 2.11) - 0.5) * 2;
            p.vx += fnx * 0.32; p.vy += fny * 0.22;
            // Boundary soft
            const bdx=p.x-W*0.5, bdy=p.y-H*0.40;
            const dN=Math.hypot(bdx/W,bdy/H);
            if (dN > 0.44) { const g=(dN-0.44)*5; p.vx-=bdx/W*g; p.vy-=bdy/H*g; }
            p.vx *= 0.967; p.vy *= 0.967;
          } else {
            // Lettera: convergenza staggered — tutte le particelle verso target
            const localT = Math.max(0, (at - p.delay) / Math.max(0.01, 1 - p.delay));
            if (localT > 0) {
              const { offsetX, offsetY } = hudRef.current;
              const tx = p.lx + offsetX, ty = p.ly + offsetY;
              const dx = tx - p.x, dy = ty - p.y;
              const dist = Math.hypot(dx, dy);
              if (dist < 1.5 && localT > 0.5) {
                // Snap finale
                p.x = tx; p.y = ty; p.vx = 0; p.vy = 0;
              } else {
                const t2 = localT * localT;
                p.vx += dx * t2 * 0.26;
                p.vy += dy * t2 * 0.26;
                p.vx *= 0.84; p.vy *= 0.84;
              }
            } else {
              // Prima dello stagger: ancora in float
              const fnx = (fbm2(nx*S + tAnim*0.22, ny*S + 1.73) - 0.5) * 2;
              const fny = (fbm2(nx*S + 7.31, ny*S + tAnim*0.22 + 2.11) - 0.5) * 2;
              p.vx += fnx * 0.22; p.vy += fny * 0.15;
              p.vx *= 0.88; p.vy *= 0.88;
            }
          }
          p.ox = p.x; p.oy = p.y;
          p.x += p.vx; p.y += p.vy;
        }
      }

      // ── Cloth physics (tenda — solo fase 2) ────────────────────────────
      if (phase === 2) {
        for (const p of pts) {
          if (p.pinned) continue;
          const vx=(p.x-p.px)*DAMPING, vy=(p.y-p.py)*DAMPING;
          p.px=p.x; p.py=p.y;
          p.x+=vx; p.y+=vy+GRAVITY;
          // Mouse
          const ddx=p.x-mx, ddy=p.y-my;
          const md2=Math.sqrt(ddx*ddx+ddy*ddy);
          if (md2 < mouseR) {
            const prox=1-md2/mouseR;
            if (down) { p.x+=(mx-p.x)*prox*0.75; p.y+=(my-p.y)*prox*0.75; }
            else { const inv=1/(md2||0.001); p.x+=ddx*inv*prox*1.8; p.y+=ddy*inv*prox*1.8; }
            p.heat=Math.min(1,p.heat+prox*0.12);
          } else { p.heat*=0.94; }
        }

        // Tear
        for (const s of segs) {
          if (!s.on) continue;
          const pa=pts[s.a],pb=pts[s.b];
          const dist=Math.hypot(pa.x-pb.x,pa.y-pb.y);
          const tear=s.rest*TEAR_MULT;
          s.ten=Math.max(0,Math.min(1,(dist-s.rest)/(tear-s.rest)));
          if (dist>tear) { s.on=false; continue; }
          if (down) {
            const cmx=(pa.x+pb.x)*0.5, cmy=(pa.y+pb.y)*0.5;
            if (Math.hypot(cmx-mx,cmy-my)<18) s.on=false;
          }
        }

        // Constraints con ramp
        if (constraintRamp > 0) {
          for (let it=0;it<ITER;it++) {
            for (const s of segs) {
              if (!s.on) continue;
              const pa=pts[s.a],pb=pts[s.b];
              const ddx=pa.x-pb.x,ddy=pa.y-pb.y;
              const dist=Math.sqrt(ddx*ddx+ddy*ddy)||0.001;
              const tear=s.rest*TEAR_MULT;
              s.ten=Math.max(0,Math.min(1,(dist-s.rest)/(tear-s.rest)));
              if (dist>tear&&constraintRamp>0.8){s.on=false;continue;}
              const diff=(dist-s.rest)/dist*0.5*constraintRamp;
              const ox=ddx*diff,oy=ddy*diff;
              if(!pa.pinned){pa.x-=ox;pa.y-=oy;}
              if(!pb.pinned){pb.x+=ox;pb.y+=oy;}
            }
          }
        }

        // Off-screen check
        let offScreen=0,unpinned=0;
        for (const p of pts) {
          if (!p.pinned) { unpinned++; if(p.y>H*1.25) offScreen++; }
        }
        if (unpinned>0 && offScreen/unpinned>=0.70) { reconstruct(lastTs); return; }

        // Dissolve trigger
        let broken=0;
        for (const s of segs) if (!s.on) broken++;
        if (broken/segs.length>=0.65) {
          dissolveTriggered=true; dissolveT=0; dissolveExploding=false;
          // Origine random del sweep radiale
          dissolveOriginX = W * (0.2 + Math.random() * 0.6);
          dissolveOriginY = H * (0.2 + Math.random() * 0.6);
          dissolveMaxR = Math.max(
            Math.hypot(dissolveOriginX, dissolveOriginY),
            Math.hypot(W-dissolveOriginX, dissolveOriginY),
            Math.hypot(dissolveOriginX, H-dissolveOriginY),
            Math.hypot(W-dissolveOriginX, H-dissolveOriginY)
          );
          // Genera dust particles — activateAt basato su distanza dall'origine
          dustParticles = [];
          for (const s of segs) {
            if (!s.on) continue;
            const pa=pts[s.a],pb=pts[s.b];
            const mx=(pa.x+pb.x)*0.5, my=(pa.y+pb.y)*0.5;
            const h=Math.max(s.ten,(pa.heat+pb.heat)*0.5);
            let r:number,g:number,b:number;
            if(h>0.72){const f=(h-0.72)/0.28;r=255;g=Math.round(210+(255-210)*f);b=Math.round(255*f);}
            else if(h>0.38){const f=(h-0.38)/0.34;r=230;g=Math.round(40+(210-40)*f);b=0;}
            else if(h>0.12){const f=(h-0.12)/0.26;r=Math.round(90+(230-90)*f);g=Math.round(185*(1-f));b=Math.round(255*(1-f));}
            else{r=90;g=185;b=255;}
            const dist=Math.hypot(mx-dissolveOriginX, my-dissolveOriginY);
            const activateAt=(dist/dissolveMaxR)*SWEEP_DUR;
            // Particelle driftano verso l'esterno dall'origine
            const outAng=Math.atan2(my-dissolveOriginY, mx-dissolveOriginX);
            for (let i=0;i<5;i++) {
              const ang=outAng+(Math.random()-0.5)*1.4;
              const spd=0.5+Math.random()*2.2;
              dustParticles.push({
                x:mx+(Math.random()-0.5)*10, y:my+(Math.random()-0.5)*10,
                vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd-0.3,
                activateAt, maxLife:0.5+Math.random()*1.0,
                r,g,b, size:0.5+Math.random()*1.8,
              });
            }
          }
        }

        if (gridEntryT<0&&!dissolveTriggered) gridEntryT=ts;
      } else {
        gridEntryT=-1;
      }

      const gridAge    = gridEntryT>=0?(ts-gridEntryT)/1000:0;
      const clearAlpha = phase===0?0.65:phase===1?0.70:0.72+0.23*Math.min(1,gridAge/1.5);
      const waterAlpha = phase<2?0:0.28;

      render(clearAlpha, false, waterAlpha);
    }

    function render(clearAlpha: number, inDissolve: boolean, waterAlpha: number) {
      const ph  = inDissolve ? 2 : curPhase;
      const at  = inDissolve ? 1 : curAt;
      const wav = inDissolve ? 0 : curWaveAmp;
      const { waveIntensity, waveSpeed, waveAngle, brightness } = hudRef.current;

      ctx.fillStyle=`rgba(11,13,20,${clearAlpha.toFixed(3)})`;
      ctx.fillRect(0,0,W,H);
      drawWater(waterAlpha);
      ctx.lineCap="round";

      // ── Particle cloud (fase 0 e 1) ───────────────────────────────────
      if (!inDissolve && ph < 2) {
        const { particleGlow, trailAlpha, trailMult } = hudRef.current;
        const partFade = ph===0 ? 1 : Math.max(0, 1 - at * 1.2);
        if (partFade > 0.01) {
          for (const p of parts) {
            const localT   = ph===1 ? Math.max(0,(at-p.delay)/Math.max(0.01,1-p.delay)) : 0;
            const converge = localT > 0.25 ? Math.min(1,(localT-0.25)/0.45) : 0;
            const baseA    = partFade * (0.28 + converge * 0.48) * brightness;

            // Scia: linea estrapolata oltre la posizione reale (trailMult × movimento)
            const dx = p.x - p.ox, dy = p.y - p.oy;
            const trailLen = Math.hypot(dx, dy);
            if (trailAlpha > 0.01) {
              const ta = Math.min(0.95, baseA * trailAlpha);
              // Tail start = extrapolato dietro la particella di trailMult frame
              const tailX = p.x - dx * trailMult;
              const tailY = p.y - dy * trailMult;
              ctx.beginPath(); ctx.moveTo(tailX, tailY); ctx.lineTo(p.x, p.y);
              ctx.strokeStyle = `rgba(210,228,255,${ta.toFixed(3)})`;
              ctx.lineWidth   = 1.2 + converge * 2.0;
              ctx.stroke();
            }
            void trailLen;

            // Glow halo bianco (anello esterno) — visibile anche in fase float
            if (particleGlow > 0.01) {
              const glowR = 3.5 + converge * 5.5;
              const glowA = Math.min(0.9, baseA * 0.55 * particleGlow);
              ctx.beginPath(); ctx.arc(p.x, p.y, glowR, 0, Math.PI*2);
              ctx.fillStyle = `rgba(210,228,255,${glowA.toFixed(3)})`; ctx.fill();
            }

            // Dot core: bianco-blu
            const coreR = 1.0 + converge * 1.4;
            const rC    = Math.round(185 + converge * 70);
            const gC    = Math.round(212 + converge * 43);
            ctx.beginPath(); ctx.arc(p.x, p.y, coreR, 0, Math.PI*2);
            ctx.fillStyle = `rgba(${rC},${gC},255,${baseA.toFixed(3)})`; ctx.fill();
          }
        }
      }

      // ── Cloth / tenda (fase 2 + dissolve) ────────────────────────────
      if (ph === 2 || inDissolve) {
        const clothFade = inDissolve ? 1 : Math.min(1, curAt > 0 ? 1 : (curPhase===2 ? Math.min(1,((performance.now()-(phase2StartT||0))/1000)/0.8) : 0));
        const lineVis   = inDissolve ? 1 : Math.min(1, (curPhase===2 ? (phase2StartT>=0?(performance.now()-phase2StartT)/1000/0.8:0) : 0));
        void clothFade;

        if (lineVis > 0.01 || inDissolve) {
          const wAngleRad = waveAngle * Math.PI / 180;
          const wDirX=Math.cos(wAngleRad), wDirY=Math.sin(wAngleRad);

          // Glow batch pre-pass
          ctx.beginPath();
          for (const s of segs) {
            if (!s.on) continue;
            if (inDissolve) {
              const pa=pts[s.a],pb=pts[s.b];
              const fA=Math.max(0,1-Math.hypot(pa.x-pa.ix,pa.y-pa.iy)/70);
              const fB=Math.max(0,1-Math.hypot(pb.x-pb.ix,pb.y-pb.iy)/70);
              if (fA*fB<0.02) continue;
            }
            ctx.moveTo(pts[s.a].x,pts[s.a].y); ctx.lineTo(pts[s.b].x,pts[s.b].y);
          }
          const lv = inDissolve ? 1 : lineVis;
          ctx.strokeStyle=`rgba(60,150,255,${(0.06*lv*brightness).toFixed(3)})`;
          ctx.lineWidth=9; ctx.stroke();
          ctx.beginPath();
          for (const s of segs) { if(!s.on) continue; ctx.moveTo(pts[s.a].x,pts[s.a].y); ctx.lineTo(pts[s.b].x,pts[s.b].y); }
          ctx.strokeStyle=`rgba(90,180,255,${(0.12*lv*brightness).toFixed(3)})`;
          ctx.lineWidth=3; ctx.stroke();

          // Per-segment: dissolve usa draw individuale (fade per-seg), normale usa batch per tier
          if (inDissolve) {
            for (const s of segs) {
              if (!s.on) continue;
              const pa=pts[s.a],pb=pts[s.b];
              const fA=Math.max(0,1-Math.hypot(pa.x-pa.ix,pa.y-pa.iy)/70);
              const fB=Math.max(0,1-Math.hypot(pb.x-pb.ix,pb.y-pb.iy)/70);
              const dissolveFade=fA*fB; if(dissolveFade<0.02) continue;
              const h=Math.max(s.ten,(pa.heat+pb.heat)*0.5);
              let r:number,g:number,b:number;
              if(h>0.72){const f=(h-0.72)/0.28;r=255;g=Math.round(210+(255-210)*f);b=Math.round(255*f);}
              else if(h>0.38){const f=(h-0.38)/0.34;r=230;g=Math.round(40+(210-40)*f);b=0;}
              else if(h>0.12){const f=(h-0.12)/0.26;r=Math.round(90+(230-90)*f);g=Math.round(185*(1-f));b=Math.round(255*(1-f));}
              else{r=90;g=185;b=255;}
              const alpha=(0.62+h*0.34)*dissolveFade*lv*brightness;
              const lw=0.5+h*1.9;
              ctx.beginPath();ctx.moveTo(pa.x,pa.y);ctx.lineTo(pb.x,pb.y);
              ctx.strokeStyle=`rgba(${r},${g},${b},${alpha.toFixed(3)})`;
              ctx.lineWidth=lw;ctx.stroke();
            }
          } else {
            // Batch per 5 tier di colore — riduce ~6500 draw call a 10
            // Tier boundaries: 0, 0.12, 0.38, 0.72, 0.85, 1.0
            const TIERS = [
              { max:0.12, r:90,  g:185, b:255, lw:0.55,  ba:0.744 },
              { max:0.38, r:155, g:92,  b:140, lw:0.975, ba:0.846 },
              { max:0.72, r:230, g:125, b:0,   lw:1.545, ba:0.95  },
              { max:0.85, r:255, g:225, b:59,  lw:1.99,  ba:0.95  },
              { max:1.01, r:255, g:248, b:190, lw:2.258, ba:0.95  },
            ];
            // Pre-calcola effH per ogni seg
            const segEffH = new Float32Array(segs.length);
            for (let si=0;si<segs.length;si++) {
              const s=segs[si]; if(!s.on){segEffH[si]=-1;continue;}
              const pa=pts[s.a],pb=pts[s.b];
              const h=Math.max(s.ten,(pa.heat+pb.heat)*0.5);
              if (wav>0.01&&waveIntensity>0.01) {
                const midX=(pa.x+pb.x)*0.5,midY=(pa.y+pb.y)*0.5;
                const proj=(midX/W)*wDirX+(midY/H)*wDirY;
                segEffH[si]=Math.min(1,h+Math.max(0,Math.sin(proj*Math.PI*5-tAnim*waveSpeed))*wav*waveIntensity*0.55);
              } else {
                segEffH[si]=h;
              }
            }
            // Disegna per tier (5 batched paths invece di ~6500 draw call)
            const tierMins = [0, 0.12, 0.38, 0.72, 0.85];
            for (let ti=0;ti<TIERS.length;ti++) {
              const tier=TIERS[ti], tMin=tierMins[ti], tMax=tier.max;
              ctx.beginPath();
              for (let si=0;si<segs.length;si++) {
                const effH=segEffH[si];
                if(effH<tMin||effH>=tMax) continue;
                ctx.moveTo(pts[segs[si].a].x,pts[segs[si].a].y);
                ctx.lineTo(pts[segs[si].b].x,pts[segs[si].b].y);
              }
              ctx.strokeStyle=`rgba(${tier.r},${tier.g},${tier.b},${(tier.ba*lv*brightness).toFixed(3)})`;
              ctx.lineWidth=tier.lw; ctx.stroke();
            }
            // Glow halo solo per seg caldi (effH > 0.45)
            ctx.beginPath();
            for (let si=0;si<segs.length;si++) {
              const effH=segEffH[si]; if(effH<0.45) continue;
              ctx.moveTo(pts[segs[si].a].x,pts[segs[si].a].y);
              ctx.lineTo(pts[segs[si].b].x,pts[segs[si].b].y);
            }
            ctx.strokeStyle=`rgba(255,140,40,${(0.15*lv*brightness).toFixed(3)})`;
            ctx.lineWidth=6; ctx.stroke();
          }

          // Pin dots + cursore (solo fase 2 non dissolve)
          if (!inDissolve) {
            for (const p of pts) {
              if (!p.pinned) continue;
              ctx.fillStyle="rgba(90,185,255,0.55)";
              ctx.beginPath();ctx.arc(p.x,p.y,2.5,0,Math.PI*2);ctx.fill();
            }
            const {x:cmx,y:cmy}=mou.current;
            if(cmx>=0&&cmx<=W&&cmy>=0&&cmy<=H){
              ctx.beginPath();ctx.arc(cmx,cmy,mouseR,0,Math.PI*2);
              ctx.strokeStyle="rgba(255,255,255,0.18)";ctx.lineWidth=1;ctx.stroke();
              ctx.beginPath();ctx.arc(cmx,cmy,2.5,0,Math.PI*2);
              ctx.fillStyle="rgba(255,255,255,0.85)";ctx.fill();
            }
          }
        }
      }

      // Gradiente + vignette (cached — riallocati solo su resize)
      if (cachedGd) { ctx.fillStyle=cachedGd; ctx.fillRect(0,0,W,H); }
      if (cachedVig) { ctx.fillStyle=cachedVig; ctx.fillRect(0,0,W,H); }
    }

    function renderThanos(sweepR: number) {
      const { brightness } = hudRef.current;
      ctx.fillStyle='rgba(11,13,20,0.50)';
      ctx.fillRect(0,0,W,H);
      drawWater(0.10);
      ctx.lineCap='round';

      // Cloth frozen — visibile dove distanza dall'origine > sweepR
      // Fade morbido al bordo radiale (±70px)
      const EDGE = 70;
      const ox=dissolveOriginX, oy=dissolveOriginY;

      ctx.beginPath();
      for (const s of segs) {
        if (!s.on) continue;
        const mx=(pts[s.a].x+pts[s.b].x)*0.5, my=(pts[s.a].y+pts[s.b].y)*0.5;
        const d=Math.hypot(mx-ox, my-oy);
        if (d <= sweepR - EDGE) continue;
        ctx.moveTo(pts[s.a].x,pts[s.a].y); ctx.lineTo(pts[s.b].x,pts[s.b].y);
      }
      ctx.strokeStyle=`rgba(60,150,255,${(0.06*brightness).toFixed(3)})`;
      ctx.lineWidth=9; ctx.stroke();

      ctx.beginPath();
      for (const s of segs) {
        if (!s.on) continue;
        const mx=(pts[s.a].x+pts[s.b].x)*0.5, my=(pts[s.a].y+pts[s.b].y)*0.5;
        const d=Math.hypot(mx-ox, my-oy);
        if (d <= sweepR - EDGE) continue;
        ctx.moveTo(pts[s.a].x,pts[s.a].y); ctx.lineTo(pts[s.b].x,pts[s.b].y);
      }
      ctx.strokeStyle=`rgba(90,180,255,${(0.12*brightness).toFixed(3)})`;
      ctx.lineWidth=3; ctx.stroke();

      // Main cloth con fade radiale al bordo sweep
      for (const s of segs) {
        if (!s.on) continue;
        const mx=(pts[s.a].x+pts[s.b].x)*0.5, my=(pts[s.a].y+pts[s.b].y)*0.5;
        const d=Math.hypot(mx-ox, my-oy);
        const edgeFade=Math.min(1,Math.max(0,(d-sweepR+EDGE)/EDGE));
        if (edgeFade < 0.02) continue;
        const h=Math.max(s.ten,(pts[s.a].heat+pts[s.b].heat)*0.5);
        let r:number,g:number,b:number;
        if(h>0.72){const f=(h-0.72)/0.28;r=255;g=Math.round(210+(255-210)*f);b=Math.round(255*f);}
        else if(h>0.38){const f=(h-0.38)/0.34;r=230;g=Math.round(40+(210-40)*f);b=0;}
        else if(h>0.12){const f=(h-0.12)/0.26;r=Math.round(90+(230-90)*f);g=Math.round(185*(1-f));b=Math.round(255*(1-f));}
        else{r=90;g=185;b=255;}
        ctx.beginPath(); ctx.moveTo(pts[s.a].x,pts[s.a].y); ctx.lineTo(pts[s.b].x,pts[s.b].y);
        ctx.strokeStyle=`rgba(${r},${g},${b},${(0.744*edgeFade*brightness).toFixed(3)})`;
        ctx.lineWidth=0.55+h*1.9; ctx.stroke();
      }

      // Dust particles
      for (const dp of dustParticles) {
        if (dissolveT < dp.activateAt) continue;
        const age=dissolveT-dp.activateAt;
        const lt=age/dp.maxLife; if(lt>=1) continue;
        const alpha=(lt<0.15?lt/0.15:(1-lt))*0.9*brightness;
        if (alpha<0.01) continue;
        ctx.fillStyle=`rgba(${dp.r},${dp.g},${dp.b},${alpha.toFixed(3)})`;
        ctx.beginPath(); ctx.arc(dp.x,dp.y,dp.size,0,Math.PI*2); ctx.fill();
      }

      if (cachedGd) { ctx.fillStyle=cachedGd; ctx.fillRect(0,0,W,H); }
      if (cachedVig) { ctx.fillStyle=cachedVig; ctx.fillRect(0,0,W,H); }
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
      <canvas ref={cvs} className="absolute inset-0 w-full h-full block cursor-none"
        style={{ touchAction: "none" }} />
      {showHud && <div className="fixed top-4 right-4 z-[100] pointer-events-auto select-none font-mono">
        <button onClick={() => setHudOpen(v => !v)}
          className="text-[9px] tracking-[0.3em] uppercase text-white/30 hover:text-white/60
            border border-white/10 hover:border-white/20 px-4 py-3 backdrop-blur-sm
            bg-black/20 transition-colors w-full text-right min-h-[44px]">
          {hudOpen ? "× close" : "hud"}
        </button>
        {hudOpen && (
          <div className="mt-1 border border-white/10 bg-black/70 backdrop-blur-md p-5 w-52">
            <p className="text-[8px] tracking-[0.35em] uppercase text-white/25 mb-5">Wave Controls</p>
            <SliderRow label="Intensity"  value={hud.waveIntensity} min={0}   max={1}   step={0.01} onChange={v=>updateHud("waveIntensity",v)} />
            <SliderRow label="Speed"      value={hud.waveSpeed}     min={0.5} max={4.0} step={0.05} onChange={v=>updateHud("waveSpeed",v)} />
            <SliderRow label="Angle"      value={hud.waveAngle}     min={0}   max={360} step={1}    onChange={v=>updateHud("waveAngle",v)} unit="°" />
            <div className="my-4 border-t border-white/10" />
            <p className="text-[8px] tracking-[0.35em] uppercase text-white/25 mb-4">Particles</p>
            <SliderRow label="Glow ×"     value={hud.particleGlow}  min={0}   max={3.0} step={0.05} onChange={v=>updateHud("particleGlow",v)} />
            <SliderRow label="Trail α"    value={hud.trailAlpha}    min={0}   max={3.0} step={0.05} onChange={v=>updateHud("trailAlpha",v)} />
            <SliderRow label="Trail ×"    value={hud.trailMult}     min={0.5} max={8.0} step={0.1}  onChange={v=>updateHud("trailMult",v)} />
            <div className="my-4 border-t border-white/10" />
            <p className="text-[8px] tracking-[0.35em] uppercase text-white/25 mb-4">Text Align</p>
            <SliderRow label="Offset X"   value={hud.offsetX}       min={-60} max={60}  step={0.5}  onChange={v=>updateHud("offsetX",v)} unit="px" />
            <SliderRow label="Offset Y"   value={hud.offsetY}       min={-60} max={60}  step={0.5}  onChange={v=>updateHud("offsetY",v)} unit="px" />
            <div className="my-4 border-t border-white/10" />
            <p className="text-[8px] tracking-[0.35em] uppercase text-white/25 mb-4">Color</p>
            <SliderRow label="Brightness" value={hud.brightness}    min={0.3} max={1.5} step={0.01} onChange={v=>updateHud("brightness",v)} />
            <button onClick={saveHud}
              className="mt-4 w-full text-[8px] tracking-[0.3em] uppercase text-white/50
                hover:text-white/80 border border-white/10 hover:border-white/25 py-2 transition-colors">
              Save
            </button>
          </div>
        )}
      </div>}
    </>
  );
}
