import { useEffect, useRef } from "react";

// ── Noise (identico HeroGridNebula) ──────────────────────────────────────────
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

const COLS = 60;
const ROWS = 28;
const GRAVITY = 0.22;
const DAMPING = 0.985;
const ITER = 6;
const MOUSE_R = 90;
const TEAR_MULT = 1.5;

const T_SETTLE  = 1.2;
const T_ATTRACT = 2.8;

interface Pt {
  x: number; y: number;
  px: number; py: number;
  pinned: boolean;
  lx: number; ly: number; ld: number;
  ix: number; iy: number;
  heat: number;
  dissolveDelay: number;
}

interface Seg {
  a: number; b: number;
  rest: number;
  on: boolean;
  ten: number;
}

// scatter=true: nodi partono in posizioni random (nube particelle)
// rest distances sempre calcolate dalla griglia
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
        ix: gx, iy: gy,
        heat: 0, dissolveDelay: 0,
      });
    }

  // Segs calcolati dalla griglia (rest distances corrette)
  const segs: Seg[] = [];
  const add = (a: number, b: number) => {
    const d = Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y);
    segs.push({ a, b, rest: d, on: true, ten: 0 });
  };
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      if (c < COLS - 1) add(i, i + 1);
      if (r < ROWS - 1) add(i, i + COLS);
    }

  // Scatter posizioni dopo aver calcolato rest distances
  if (scatter) {
    for (const p of pts) {
      if (p.pinned) continue;
      p.x  = W * 0.5 + (Math.random() - 0.5) * W * 0.92;
      p.y  = H * 0.42 + (Math.random() - 0.5) * H * 0.65;
      p.px = p.x; p.py = p.y;
      p.ix = p.x; p.iy = p.y;
    }
  }

  return { pts, segs };
}

async function sampleLetters(W: number, H: number): Promise<{ x: number; y: number }[]> {
  await document.fonts.ready;
  const oc = document.createElement("canvas");
  oc.width = W; oc.height = H;
  const ox = oc.getContext("2d")!;
  const fs = Math.max(36, Math.min(W * 0.095, 84));
  ox.fillStyle = "#fff";
  ox.font = `italic ${fs}px "Cormorant Garamond", serif`;
  ox.textAlign = "center";
  ox.textBaseline = "middle";
  const cy = H * 0.42;
  ox.fillText("INDUSTRIAL", W / 2, cy - fs * 0.7);
  ox.fillText("MAGIC",      W / 2, cy + fs * 0.7);
  const d = ox.getImageData(0, 0, W, H).data;
  const out: { x: number; y: number }[] = [];
  const step = 5;
  for (let y = 0; y < H; y += step)
    for (let x = 0; x < W; x += step)
      if (d[(y * W + x) * 4 + 3] > 100) out.push({ x, y });
  return out;
}

function assignTargets(pts: Pt[], lp: { x: number; y: number }[]) {
  if (!lp.length) return;
  for (const p of pts) {
    if (p.pinned) continue;
    let minD = Infinity, nx = p.x, ny = p.y;
    for (const q of lp) {
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      if (d < minD) { minD = d; nx = q.x; ny = q.y; }
    }
    p.lx = nx; p.ly = ny; p.ld = minD;
  }
}

export function ClothDemo2() {
  const cvs = useRef<HTMLCanvasElement>(null);
  const mou = useRef({ x: -9999, y: -9999, down: false });
  const raf = useRef<number>(0);

  useEffect(() => {
    const canvas = cvs.current!;
    const ctx = canvas.getContext("2d")!;
    let W = 0, H = 0;
    let pts: Pt[] = [], segs: Seg[] = [];
    let t0: number | null = null;
    let ready = false;
    let letterPixels: { x: number; y: number }[] = [];
    let tAnim = 0;

    // Water offscreen
    const WW = 240, WH = 135;
    const wCanvas = document.createElement("canvas");
    wCanvas.width = WW; wCanvas.height = WH;
    const wCtx = wCanvas.getContext("2d")!;
    const wData = wCtx.createImageData(WW, WH);

    function drawWater(alpha: number) {
      if (alpha <= 0.01) return;
      const d = wData.data;
      const t = tAnim;
      for (let py = 0; py < WH; py++) {
        for (let px = 0; px < WW; px++) {
          const nx = px / WW * 3.2, ny = py / WH * 1.8;
          const w1 = fbm2(nx + t * 0.055, ny + 0.5 + t * 0.038, 4);
          const w2 = fbm2(nx * 0.55 + 4.1 - t * 0.041, ny * 0.75 + 2.3 + t * 0.049, 4);
          const shimmer = Math.max(0, vnoise2(nx * 2.1 + t * 0.09, ny * 2.3 + 6.1 - t * 0.07) - 0.62) * 2.8;
          const h = Math.max(0, Math.min(1, w1 * 0.55 + w2 * 0.45));
          let r: number, g: number, b: number;
          if (h < 0.5) { const f = h * 2; r = Math.round(8+32*f); g = Math.round(22+68*f); b = Math.round(55+90*f); }
          else { const f = (h-0.5)*2; r = Math.round(40+30*f+shimmer*60); g = Math.round(90+70*f+shimmer*80); b = Math.round(145+65*f+shimmer*60); }
          const idx = (py * WW + px) * 4;
          d[idx]=Math.min(255,r); d[idx+1]=Math.min(255,g); d[idx+2]=Math.min(255,b); d[idx+3]=255;
        }
      }
      wCtx.putImageData(wData, 0, 0);
      ctx.globalAlpha = alpha;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(wCanvas, 0, 0, W, H);
      ctx.globalAlpha = 1;
      ctx.imageSmoothingEnabled = false;
    }

    // Dissolve state
    let dissolveTriggered = false;
    let dissolveExploding = false;
    let dissolveOriginX = 0, dissolveOriginY = 0;
    let dissolveT = 0;
    let gridEntryT = -1;

    // Idle wave: traccia ultima interazione mouse
    let lastMouseT = -99999;

    // Closure vars accessibili in render()
    let currentPhase = 0;
    let currentAt = 0;
    let currentWaveAmp = 0;

    const reconstruct = (ts: number) => {
      const d = build(W, H); // no scatter: upward wave animation
      pts = d.pts; segs = d.segs;
      assignTargets(pts, letterPixels);
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const p = pts[r * COLS + c];
          if (p.pinned) continue;
          const upwardV = 1.5 + (r / (ROWS - 1)) * 10;
          p.py = p.y + upwardV;
          p.px = p.x + (Math.random() - 0.5) * 1.5;
        }
      }
      dissolveTriggered = false;
      dissolveExploding = false;
      dissolveT = 0;
      gridEntryT = -1;
      t0 = ts;
    };

    const resize = () => {
      W = canvas.offsetWidth; H = canvas.offsetHeight;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const d = build(W, H, true); // scatter=true: nube particelle all'avvio
      pts = d.pts; segs = d.segs;
      ready = false; t0 = null; letterPixels = [];
      dissolveTriggered = false; dissolveExploding = false; dissolveT = 0; gridEntryT = -1;
      sampleLetters(W, H).then(lp => {
        letterPixels = lp;
        // assignTargets usa le posizioni GRIGLIA (lx/ly già settate in build), ok
        assignTargets(pts, lp);
        ready = true;
      });
    };
    resize();
    window.addEventListener("resize", resize);

    const pos = (e: MouseEvent | Touch) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const mm = (e: MouseEvent) => {
      Object.assign(mou.current, pos(e));
      lastMouseT = performance.now();
    };
    const md = (e: MouseEvent) => { mou.current.down = true; mm(e); };
    const mu = () => { mou.current.down = false; };
    window.addEventListener("mousemove", mm);
    canvas.addEventListener("mousedown", md);
    window.addEventListener("mouseup", mu);
    canvas.addEventListener("touchmove", (e) => {
      e.preventDefault();
      const p = pos(e.touches[0]);
      mou.current.x = p.x; mou.current.y = p.y;
      lastMouseT = performance.now();
    }, { passive: false });
    canvas.addEventListener("touchstart", (e) => {
      mou.current.down = true;
      const p = pos(e.touches[0]);
      mou.current.x = p.x; mou.current.y = p.y;
      lastMouseT = performance.now();
    });
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

      const phase = el < T_SETTLE ? 0
        : el < T_SETTLE + T_ATTRACT ? 1 : 2;
      const at = phase > 0 ? Math.min(1, (el - T_SETTLE) / T_ATTRACT) : 0;

      // Constraint ramp: fase 0 = no constraints (particelle libere)
      // fase 1 = rampa 0→1 (cloth si forma) · fase 2 = pieno
      const constraintRamp = phase === 0 ? 0 : phase === 1 ? Math.min(1, at * 3.5) : 1;

      // Idle wave: sale dopo 2s di inattività, solo in fase 2
      const idleMs = phase === 2 && !dissolveTriggered ? Math.max(0, ts - lastMouseT - 2000) : 0;
      const waveAmp = Math.min(1, idleMs / 2000);

      currentPhase = phase;
      currentAt = at;
      currentWaveAmp = waveAmp;

      // ── Dissolve physics ──────────────────────────────────────────────
      if (dissolveTriggered) {
        dissolveT += dt;

        if (!dissolveExploding) {
          for (const p of pts) {
            if (p.pinned) continue;
            if (dissolveT < p.dissolveDelay) {
              const nx = (Math.sin(p.ix * 13.7 + dissolveT * 4.2) - 0.5) * 3.5;
              const ny = (Math.sin(p.iy * 19.3 + dissolveT * 3.8 + 2.1) - 0.5) * 3.5;
              p.x += nx; p.y += ny;
            } else {
              const odx = p.x - dissolveOriginX, ody = p.y - dissolveOriginY;
              const olen = Math.hypot(odx, ody) + 0.5;
              p.x += (odx / olen) * 0.55;
              p.y += (ody / olen) * 0.55;
              p.heat = Math.min(1, p.heat + 0.005);
            }
          }
        }

        for (const p of pts) {
          if (p.pinned) continue;
          const vx = (p.x - p.px) * DAMPING;
          const vy = (p.y - p.py) * DAMPING;
          p.px = p.x; p.py = p.y;
          p.x += vx; p.y += vy;
          p.heat *= 0.985;
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

        if (dissolveExploding && dissolveT >= 6.0) {
          reconstruct(lastTs);
        }

        render(0.055, true, 0.10);
        return;
      }

      // ── Physics ───────────────────────────────────────────────────────
      for (const p of pts) {
        if (p.pinned) continue;
        const vx = (p.x - p.px) * DAMPING;
        const vy = (p.y - p.py) * DAMPING;
        p.px = p.x; p.py = p.y;
        p.x += vx; p.y += vy + GRAVITY;

        // Attrazione lettera (fase 1+)
        if (ready && at > 0.04) {
          const t = Math.max(0, at - 0.04) / 0.96;
          const isLetter = p.ld < 28;
          if (isLetter) {
            const heatMask = phase === 2 ? Math.max(0, 1 - p.heat * 4) : 1;
            const str = Math.min(0.38, t * t * 0.42) * heatMask;
            const ddx = p.lx - p.x, ddy = p.ly - p.y;
            p.x += ddx * str;
            p.y += ddy * str;
            p.y -= GRAVITY * Math.min(1, str / 0.20) * heatMask;
            p.px += ddx * str * 0.58;
            p.py += ddy * str * 0.58;
          } else if (phase === 1) {
            const extraG = Math.min(0.10, t * t * 0.12);
            p.y += extraG;
          }
        }

        // Mouse
        const ddx = p.x - mx, ddy = p.y - my;
        const md2 = Math.sqrt(ddx * ddx + ddy * ddy);
        if (md2 < MOUSE_R) {
          const prox = (1 - md2 / MOUSE_R);
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

      // ── Tear (solo fase 2) ────────────────────────────────────────────
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

      // ── Constraints (con ramp per fase 0/1) ──────────────────────────
      if (constraintRamp > 0) {
        for (let it = 0; it < ITER; it++) {
          for (const s of segs) {
            if (!s.on) continue;
            const pa = pts[s.a], pb = pts[s.b];
            const ddx = pa.x - pb.x, ddy = pa.y - pb.y;
            const dist = Math.sqrt(ddx * ddx + ddy * ddy) || 0.001;
            const tear = s.rest * TEAR_MULT;
            s.ten = Math.max(0, Math.min(1, (dist - s.rest) / (tear - s.rest)));
            if (dist > tear && phase === 2) { s.on = false; continue; }
            const diff = (dist - s.rest) / dist * 0.5 * constraintRamp;
            const ox = ddx * diff, oy = ddy * diff;
            if (!pa.pinned) { pa.x -= ox; pa.y -= oy; }
            if (!pb.pinned) { pb.x += ox; pb.y += oy; }
          }
        }
      }

      // ── Off-screen → reconstruct ──────────────────────────────────────
      if (phase === 2 && ready && !dissolveTriggered) {
        let offScreen = 0, unpinned = 0;
        for (const p of pts) {
          if (!p.pinned) { unpinned++; if (p.y > H * 1.25) offScreen++; }
        }
        if (unpinned > 0 && offScreen / unpinned >= 0.70) {
          reconstruct(lastTs);
        }
      }

      // ── Dissolve trigger ──────────────────────────────────────────────
      if (phase === 2 && ready && !dissolveTriggered) {
        let broken = 0;
        for (const s of segs) if (!s.on) broken++;
        if (broken / segs.length >= 0.45) {
          dissolveTriggered = true;
          dissolveT = 0;
          let hcx = 0, hcy = 0, hc = 0;
          for (const p of pts) {
            if (!p.pinned && p.heat > 0.2) { hcx += p.x; hcy += p.y; hc++; }
          }
          dissolveOriginX = hc > 0 ? hcx / hc : W * 0.5;
          dissolveOriginY = hc > 0 ? hcy / hc : H * 0.45;
          const maxDist = Math.hypot(W, H);
          for (const p of pts) {
            p.px = p.x; p.py = p.y;
            p.ix = p.x; p.iy = p.y;
            p.dissolveDelay = Math.hypot(p.x - dissolveOriginX, p.y - dissolveOriginY) / maxDist * 1.5;
          }
        }
      }

      if (phase === 2 && gridEntryT < 0 && !dissolveTriggered) gridEntryT = ts;
      if (dissolveTriggered || phase < 2) gridEntryT = -1;
      const gridAge = gridEntryT >= 0 ? (ts - gridEntryT) / 1000 : 0;
      const clearAlpha = phase === 0 ? 0.65
        : phase === 1 ? 0.72
        : 0.72 + 0.23 * Math.min(1, gridAge / 1.5);

      const waterAlpha = phase === 0 ? 0
        : phase === 1 ? Math.min(1, (el - T_SETTLE) / T_ATTRACT) * 0.18
        : 0.18;

      render(clearAlpha, false, waterAlpha);
    }

    function render(clearAlpha: number, inDissolve: boolean, waterAlpha: number) {
      const ph  = inDissolve ? 2 : currentPhase;
      const at  = inDissolve ? 1 : currentAt;
      const waveAmp = inDissolve ? 0 : currentWaveAmp;

      ctx.fillStyle = `rgba(11,13,20,${clearAlpha.toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
      drawWater(waterAlpha);
      ctx.lineCap = "round";

      // ── Visibilità linee / punti per fase ─────────────────────────────
      // fase 0: punti soli (nube particelle libere)
      // fase 1: punti che si spengono mentre appaiono le linee
      // fase 2: solo linee
      const lineVis = ph === 0 ? 0 : ph === 1 ? Math.min(1, at * 1.8) : 1;
      const dotVis  = ph === 0 ? 1 : ph === 1 ? Math.max(0, 1 - at * 2.2) : 0;

      // ── Dot render (nube particelle) ──────────────────────────────────
      if (dotVis > 0.01) {
        for (const p of pts) {
          if (p.pinned) continue;
          // Intensità basata su vicinanza al target lettera
          const nearLetter = p.ld < 28 && at > 0.05 ? Math.min(1, (at - 0.05) / 0.4) : 0;
          const dotA = dotVis * (0.35 + nearLetter * 0.55);
          const dotR = 1.2 + nearLetter * 1.4;
          // Colore base: blu brillante; nodi-lettera: bianco-azzurro
          const rc = Math.round(80 + nearLetter * 140);
          const gc = Math.round(170 + nearLetter * 75);
          const bc = 255;
          ctx.beginPath(); ctx.arc(p.x, p.y, dotR, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${rc},${gc},${bc},${dotA.toFixed(3)})`;
          ctx.fill();
          // Glow dot
          if (dotA > 0.25) {
            ctx.beginPath(); ctx.arc(p.x, p.y, dotR * 3.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(80,170,255,${(dotA * 0.08).toFixed(3)})`;
            ctx.fill();
          }
        }
      }

      // ── Segment render ────────────────────────────────────────────────
      if (lineVis > 0.01) {
        // Glow pre-pass 1 (alone blu ampia, batch)
        ctx.beginPath();
        for (const s of segs) {
          if (!s.on) continue;
          if (inDissolve) {
            const pa = pts[s.a], pb = pts[s.b];
            const fadeA = Math.max(0, 1 - Math.hypot(pa.x - pa.ix, pa.y - pa.iy) / 180);
            const fadeB = Math.max(0, 1 - Math.hypot(pb.x - pb.ix, pb.y - pb.iy) / 180);
            if (fadeA * fadeB < 0.02) continue;
          }
          ctx.moveTo(pts[s.a].x, pts[s.a].y);
          ctx.lineTo(pts[s.b].x, pts[s.b].y);
        }
        ctx.strokeStyle = `rgba(60,150,255,${(0.055 * lineVis).toFixed(3)})`;
        ctx.lineWidth = 9;
        ctx.stroke();

        // Glow pre-pass 2 (alone interna)
        ctx.beginPath();
        for (const s of segs) {
          if (!s.on) continue;
          ctx.moveTo(pts[s.a].x, pts[s.a].y);
          ctx.lineTo(pts[s.b].x, pts[s.b].y);
        }
        ctx.strokeStyle = `rgba(90,180,255,${(0.12 * lineVis).toFixed(3)})`;
        ctx.lineWidth = 3.5;
        ctx.stroke();

        // Per-segment: colore + onda idle
        for (const s of segs) {
          if (!s.on) continue;
          const pa = pts[s.a], pb = pts[s.b];
          const h = Math.max(s.ten, (pa.heat + pb.heat) * 0.5);

          let dissolveFade = 1;
          if (inDissolve) {
            const fadeA = Math.max(0, 1 - Math.hypot(pa.x - pa.ix, pa.y - pa.iy) / 180);
            const fadeB = Math.max(0, 1 - Math.hypot(pb.x - pb.ix, pb.y - pb.iy) / 180);
            dissolveFade = fadeA * fadeB;
            if (dissolveFade < 0.02) continue;
          }

          // Onda idle: illumina la rete da sx → dx quando mouse inattivo
          let effectiveH = h;
          if (waveAmp > 0.01) {
            const midX = (pa.x + pb.x) * 0.5;
            const waveRaw = Math.sin((midX / W) * Math.PI * 5.0 - tAnim * 2.2);
            const waveV = Math.max(0, waveRaw) * waveAmp * 0.55;
            effectiveH = Math.min(1, h + waveV);
          }

          let r: number, g: number, b: number;
          if (effectiveH > 0.72) {
            const f = (effectiveH - 0.72) / 0.28;
            r = 255; g = Math.round(210 + (255 - 210) * f); b = Math.round(255 * f);
          } else if (effectiveH > 0.38) {
            const f = (effectiveH - 0.38) / 0.34;
            r = 230; g = Math.round(40 + (210 - 40) * f); b = 0;
          } else if (effectiveH > 0.12) {
            const f = (effectiveH - 0.12) / 0.26;
            r = Math.round(90 + (230 - 90) * f);
            g = Math.round(185 * (1 - f));
            b = Math.round(255 * (1 - f));
          } else {
            // Base: blu brillante (forte contrasto su sfondo scuro)
            r = 90; g = 185; b = 255;
          }

          // Alpha più alta per contrasto base
          const alpha = (0.62 + effectiveH * 0.34) * dissolveFade * lineVis;
          const lw    = 0.5 + effectiveH * 1.9;

          // Bloom per heat alta
          if (effectiveH > 0.45) {
            ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
            ctx.strokeStyle = `rgba(${r},${g},${b},${(alpha * 0.16 * dissolveFade).toFixed(3)})`;
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
          ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill();
        }
      }

      // Cursore
      const { x: cmx, y: cmy } = mou.current;
      if (!inDissolve && ph === 2 && cmx >= 0 && cmx <= W && cmy >= 0 && cmy <= H) {
        ctx.beginPath(); ctx.arc(cmx, cmy, MOUSE_R, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,0.18)";
        ctx.lineWidth = 1; ctx.stroke();
        ctx.beginPath(); ctx.arc(cmx, cmy, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.fill();
      }

      // Gradiente inferiore
      const gd = ctx.createLinearGradient(0, H * 0.65, 0, H);
      gd.addColorStop(0, "rgba(0,0,0,0)");
      gd.addColorStop(1, "rgba(11,13,20,1)");
      ctx.fillStyle = gd; ctx.fillRect(0, 0, W, H);

      // Vignette
      const vig = ctx.createRadialGradient(W * 0.5, H * 0.5, W * 0.18, W * 0.5, H * 0.5, W * 0.82);
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(11,13,20,0.72)");
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
    <canvas
      ref={cvs}
      className="absolute inset-0 w-full h-full block cursor-none"
      style={{ touchAction: "none" }}
    />
  );
}
