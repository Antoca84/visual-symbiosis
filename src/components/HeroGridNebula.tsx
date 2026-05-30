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
function fbm2(x: number, y: number, o = 3): number {
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
const P1       = 1.8;   // float (s)
const P_LETTER = 1.8;   // letter formation (s)
const P2       = 2.2;   // converge to grid (s)

// ── Grid config ───────────────────────────────────────────────────────────────
const COLS    = 65;
const ROWS    = 38;
const N_NODES = COLS * ROWS;
const SPAN_X  = 4.4;
const SPAN_Y  = 2.5;
const CAM_DIST = 2.0;

// ── Node ──────────────────────────────────────────────────────────────────────
interface Node {
  rx: number; ry: number;
  x:  number; y:  number; z: number;
  vx: number; vy: number; vz: number;
  dx: number; dy: number; dz: number;
  heat: number;
  convDelay: number;
  letterTarget: { wx: number; wy: number } | null;
  letterDelay: number;
  locked: boolean;
  tier: 0 | 1 | 2;
  burnCount: number;
  wasHot: boolean;
  dissolveDelay: number;
}

function makeNodes(): Node[] {
  const maxDist = Math.sqrt(SPAN_X * SPAN_X + SPAN_Y * SPAN_Y);
  return Array.from({ length: N_NODES }, (_, i) => {
    const c = i % COLS, r = Math.floor(i / COLS);
    const rx = (c / (COLS - 1) - 0.5) * SPAN_X * 2;
    const ry = (r / (ROWS - 1) - 0.5) * SPAN_Y * 2;
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
      heat: 0,
      convDelay: (Math.sqrt(rx*rx + ry*ry) / maxDist) * 0.72,
      letterTarget: null,
      letterDelay: Math.random() * 0.35,
      locked: false,
      tier: roll < 0.76 ? 0 : roll < 0.93 ? 1 : 2,
      burnCount: 0,
      wasHot: false,
      dissolveDelay: 0,
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
  const waterRef   = useRef<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; data: ImageData } | null>(null);
  const phaseRef   = useRef<string>("float");

  useEffect(() => scrollYProgress.on("change", v => { scrollRef.current = v; }), [scrollYProgress]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext("2d")!;
    let W = 0, H = 0;
    const nodes = nodesRef.current;
    let letterSampled = false;

    // Dissolve state (closure vars, reset on restart)
    let dissolveTriggered = false;
    let dissolveExploding = false;
    let dissolveStartTs: number | null = null;
    let dissolveOriginRx = 0, dissolveOriginRy = 0; // centroide hotspot in grid space
    let sustainedHeatFrames = 0;
    let gridEntryTs: number | null = null;
    let idleFrames = 0;

    const isMobile = () => window.innerWidth < 768;
    const MOB    = isMobile();
    const yScale = MOB ? 0.68 : 1.0; // compress grid height on mobile portrait

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.offsetWidth;
      H = canvas.offsetHeight;
      canvas.width  = W * dpr;
      canvas.height = H * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Projection vertical center — mobile shifted up so letter formation (H*0.50) sits below center
    const projCenterY = MOB ? H * 0.40 : H * 0.46;

    // Sample "Industrial\nMagic" pixel positions → assign as letter targets to nodes
    const sampleLetterPositions = async () => {
      await document.fonts.ready;
      // Double rAF: ensures Framer Motion has painted and layout is stable
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (!W || !H) return;

      const FL = Math.min(W, H) * 0.36;

      const h1El = document.querySelector("h1");
      if (!h1El) return;
      const cs         = getComputedStyle(h1El);
      // Fallbacks defend against iOS returning empty/NaN values
      const fontFamily     = cs.fontFamily || "serif";
      const ls             = parseFloat(cs.letterSpacing) || 0;
      const actualFontSize = parseFloat(cs.fontSize) || (MOB ? 48 : 160);

      // DOM coords: with h-svh, canvas height = visual viewport = window.innerHeight.
      // getBoundingClientRect() is in visual viewport space = canvas space. Works on both.
      const h1Rect     = h1El.getBoundingClientRect();
      const fontSize   = actualFontSize;
      const padLeft    = h1Rect.left;
      const industrial_y = h1Rect.top + actualFontSize * 0.78;
      const magic_y      = industrial_y + actualFontSize * 0.85;

      const tc = document.createElement("canvas");
      tc.width = W; tc.height = H;
      const tCtx = tc.getContext("2d")!;
      tCtx.fillStyle = "white";
      tCtx.font = `${fontSize}px ${fontFamily}`;
      tCtx.textAlign = "left";
      tCtx.textBaseline = "alphabetic";
      if ("letterSpacing" in tCtx)
        (tCtx as unknown as Record<string,string>).letterSpacing =
          `${(isNaN(ls) ? fontSize * 0.04 : ls).toFixed(1)}px`;
      tCtx.fillText("Industrial", padLeft, industrial_y);
      tCtx.fillText("Magic",      padLeft, magic_y);

      const stride = MOB ? 3 : 5;
      const imgData = tCtx.getImageData(0, 0, W, H);
      const pix = imgData.data;
      const candidates: Array<{ wx: number; wy: number }> = [];

      for (let sy = 0; sy < H; sy += stride) {
        for (let sx = 0; sx < W; sx += stride) {
          if (pix[(sy * W + sx) * 4 + 3] > 128) {
            candidates.push({
              wx: (sx - W * 0.5) * CAM_DIST / FL,
              // divide by yScale so project() maps back to the same screen pixel
              wy: (projCenterY - sy) * CAM_DIST / (FL * yScale),
            });
          }
        }
      }

      if (candidates.length < 80) return;

      // Fisher-Yates shuffle candidates
      for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      }

      const assign = Math.min(candidates.length, N_NODES);
      for (let i = 0; i < assign; i++) {
        nodes[i].letterTarget = candidates[i];
      }
      letterSampled = true;
    };
    sampleLetterPositions();

    const getCanvasPos = (clientX: number, clientY: number) => {
      const r = canvas.getBoundingClientRect();
      return { x: clientX - r.left, y: clientY - r.top };
    };
    canvas.addEventListener("mousemove", (e) => { mouseRef.current = getCanvasPos(e.clientX, e.clientY); });
    canvas.addEventListener("mouseleave", () => { mouseRef.current = { x: -9999, y: -9999 }; });

    // iOS decides scroll vs. interact at touchstart — preventDefault must fire there.
    // We only capture touches that START inside the projected grid bounds.
    let touchCaptured = false;

    const isOnGrid = (clientX: number, clientY: number): boolean => {
      if (phaseRef.current !== "grid" && phaseRef.current !== "dissolve") return false;
      const FL = Math.min(W, H) * 0.36;
      const currentProjCenterY = window.innerWidth < 768 ? H * 0.40 : H * 0.46;
      const halfW = SPAN_X * (FL / CAM_DIST) + 70;
      const halfH = SPAN_Y * (FL / CAM_DIST) * yScale + 70;
      const r = canvas.getBoundingClientRect();
      const px = clientX - r.left;
      const py = clientY - r.top;
      return Math.abs(px - W * 0.5) < halfW && Math.abs(py - currentProjCenterY) < halfH;
    };

    canvas.addEventListener("touchstart", (e) => {
      const touch = e.touches[0];
      touchCaptured = isOnGrid(touch.clientX, touch.clientY);
      if (touchCaptured) {
        mouseRef.current = getCanvasPos(touch.clientX, touch.clientY);
        e.preventDefault();
      }
    }, { passive: false });
    canvas.addEventListener("touchmove", (e) => {
      const touch = e.touches[0];
      if (touchCaptured) {
        mouseRef.current = getCanvasPos(touch.clientX, touch.clientY);
        e.preventDefault();
      }
    }, { passive: false });
    canvas.addEventListener("touchend", () => { touchCaptured = false; mouseRef.current = { x: -9999, y: -9999 }; });

    // Water offscreen buffer
    const WW = isMobile() ? 120 : 240, WH = isMobile() ? 68 : 135;
    const wCanvas = document.createElement("canvas");
    wCanvas.width = WW; wCanvas.height = WH;
    const wCtx = wCanvas.getContext("2d")!;
    waterRef.current = { canvas: wCanvas, ctx: wCtx, data: wCtx.createImageData(WW, WH) };

    type ProjResult = { sx: number; sy: number; s: number } | null;
    const projCache: ProjResult[] = new Array(N_NODES).fill(null);

    function project(wx: number, wy: number, wz: number, FL: number): ProjResult {
      const dz = wz + CAM_DIST;
      if (dz < 0.01) return null;
      const s = FL / dz;
      return { sx: W * 0.5 + wx * s, sy: projCenterY - wy * s * yScale, s };
    }

    function drawWater(t: number, alpha: number) {
      const wr = waterRef.current;
      if (!wr || alpha <= 0.01) return;
      const { canvas: wc, ctx: wCtx, data: wd } = wr;
      const dW = wc.width, dH = wc.height;
      const d = wd.data;
      for (let py = 0; py < dH; py++) {
        for (let px = 0; px < dW; px++) {
          const nx = px / dW * 3.2;
          const ny = py / dH * 1.8;
          const w1 = fbm2(nx + t * 0.055, ny + 0.5 + t * 0.038, 4);
          const w2 = fbm2(nx * 0.55 + 4.1 - t * 0.041, ny * 0.75 + 2.3 + t * 0.049, 4);
          const shimmer = Math.max(0, vnoise2(nx * 2.1 + t * 0.09, ny * 2.3 + 6.1 - t * 0.07) - 0.62) * 2.8;
          const h = Math.max(0, Math.min(1, w1 * 0.55 + w2 * 0.45));
          let r, g, b;
          if (h < 0.5) {
            const f = h * 2;
            r = Math.round(8  + 32 * f);
            g = Math.round(22 + 68 * f);
            b = Math.round(55 + 90 * f);
          } else {
            const f = (h - 0.5) * 2;
            r = Math.round(40  + 30 * f + shimmer * 60);
            g = Math.round(90  + 70 * f + shimmer * 80);
            b = Math.round(145 + 65 * f + shimmer * 60);
          }
          const idx = (py * dW + px) * 4;
          d[idx]   = Math.min(255, r);
          d[idx+1] = Math.min(255, g);
          d[idx+2] = Math.min(255, b);
          d[idx+3] = 255;
        }
      }
      wCtx.putImageData(wd, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.globalAlpha = alpha;
      ctx.drawImage(wc, 0, 0, W, H);
      ctx.globalAlpha = 1;
      ctx.imageSmoothingEnabled = false;
    }

    function draw(ts: number) {
      rafRef.current = requestAnimationFrame(draw);
      if (startRef.current === null) startRef.current = ts;
      const elapsed = (ts - startRef.current) / 1000;
      tRef.current += 0.011;
      const t = tRef.current;

      const rawPhase: "float" | "letter" | "converge" | "grid" =
        elapsed < P1                   ? "float"    :
        elapsed < P1 + P_LETTER        ? "letter"   :
        elapsed < P1 + P_LETTER + P2   ? "converge" : "grid";
      const phase: "float" | "letter" | "converge" | "grid" | "dissolve" =
        rawPhase === "grid" && dissolveTriggered ? "dissolve" : rawPhase;
      phaseRef.current = phase;

      // Track when grid phase first begins (reset on dissolve cycle)
      if (rawPhase === "grid" && !dissolveTriggered && gridEntryTs === null) gridEntryTs = ts;
      if (dissolveTriggered) gridEntryTs = null;
      const gridAge = gridEntryTs !== null ? (ts - gridEntryTs) / 1000 : 0;

      const dissolveElapsed = dissolveTriggered && dissolveStartTs !== null
        ? (ts - dissolveStartTs) / 1000 : 0;

      const phaseT =
        phase === "letter"   ? Math.min(1, (elapsed - P1) / P_LETTER) :
        phase === "converge" ? Math.min(1, (elapsed - P1 - P_LETTER) / P2) : 1;

      const FL = Math.min(W, H) * 0.36;

      // ── Clear ────────────────────────────────────────────────────────────────
      ctx.globalCompositeOperation = "source-over";
      const clearAlpha = phase === "dissolve" ? 0.055 :
                         phase === "grid"     ? 0.18 + 0.74 * Math.min(1, gridAge / 1.5) :
                         phase === "letter"   ? 0.18  : 0.11;
      ctx.fillStyle = `rgba(${BG[0]},${BG[1]},${BG[2]},${clearAlpha})`;
      ctx.fillRect(0, 0, W, H);

      // ── Water background (skip on mobile; fades in during converge on desktop) ─
      const waterAlpha = MOB
        ? 0
        : phase === "float" || phase === "letter" ? 0
        : phase === "converge" ? phaseT * 0.55 : 0.55;
      drawWater(t, waterAlpha);

      const { x: mX, y: mY } = mouseRef.current;
      const scrollTiltY = scrollRef.current * 0.4;

      // ── Physics ───────────────────────────────────────────────────────────────
      for (const n of nodes) {
        if (phase === "float") {
          const S = 0.48;
          const fnx = (fbm2(n.x * S + t * 0.26, n.y * S + 1.73) - 0.5) * 2;
          const fny = (fbm2(n.x * S + 7.31, n.y * S + t * 0.26 + 2.11) - 0.5) * 2;
          n.vx += fnx * 0.0017;
          n.vy += fny * 0.0017;
          // z-noise solo per tier 1/2 (risparmia ~24% fbm2 calls in float)
          if (n.tier > 0) {
            const fnz = (fbm2(n.z * 0.4 + t * 0.18, n.x * 0.3 + 4.0) - 0.5) * 2;
            n.vz += fnz * 0.001;
          }
          const d = Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z);
          if (d > 0.9) { const g = (d - 0.9) * 0.00038; n.vx -= n.x * g; n.vy -= n.y * g; n.vz -= n.z * g; }
          n.vx *= 0.967; n.vy *= 0.967; n.vz *= 0.967;
          n.x += n.vx; n.y += n.vy; n.z += n.vz;

        } else if (phase === "letter") {
          const target = n.letterTarget;
          if (target && letterSampled) {
            const localT = Math.max(0, (phaseT - n.letterDelay) / Math.max(0.01, 1 - n.letterDelay));
            if (localT > 0) {
              const force = localT * localT * (MOB ? 0.22 : 0.14);
              n.vx += (target.wx - n.x) * force;
              n.vy += (target.wy - n.y) * force;
              n.vz += (0 - n.z) * force;
            } else {
              // Still floating before individual delay kicks in
              const S = 0.48;
              n.vx += (fbm2(n.x * S + t * 0.22, n.y * S + 1.73) - 0.5) * 2 * 0.0011;
              n.vy += (fbm2(n.x * S + 7.31, n.y * S + t * 0.22 + 2.11) - 0.5) * 2 * 0.0011;
            }
          } else {
            // No letter target (or sampling not done) — keep floating
            const S = 0.48;
            const fnx = (fbm2(n.x * S + t * 0.26, n.y * S + 1.73) - 0.5) * 2;
            const fny = (fbm2(n.x * S + 7.31, n.y * S + t * 0.26 + 2.11) - 0.5) * 2;
            const fnz = (fbm2(n.z * 0.4 + t * 0.18, n.x * 0.3 + 4.0) - 0.5) * 2;
            n.vx += fnx * 0.0017;
            n.vy += fny * 0.0017;
            n.vz += fnz * 0.001;
            const d = Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z);
            if (d > 0.9) { const g = (d - 0.9) * 0.00038; n.vx -= n.x * g; n.vy -= n.y * g; n.vz -= n.z * g; }
          }
          n.vx *= 0.88; n.vy *= 0.88; n.vz *= 0.88;
          n.x += n.vx; n.y += n.vy; n.z += n.vz;

        } else if (phase === "converge" && !n.locked) {
          const localT = Math.max(0, (phaseT - n.convDelay) / Math.max(0.01, 1 - n.convDelay));
          if (localT > 0) {
            const force = localT * localT * 0.20;
            n.vx += (n.rx - n.x) * force;
            n.vy += (n.ry - n.y) * force;
            n.vz += (0    - n.z) * force;
          } else {
            const S = 0.48;
            n.vx += (fbm2(n.x * S + t * 0.22, n.y * S + 1.73) - 0.5) * 2 * 0.0011;
            n.vy += (fbm2(n.x * S + 7.31, n.y * S + t * 0.22 + 2.11) - 0.5) * 2 * 0.0011;
          }
          n.vx *= 0.86; n.vy *= 0.86; n.vz *= 0.86;
          n.x += n.vx; n.y += n.vy; n.z += n.vz;
          if (Math.hypot(n.x - n.rx, n.y - n.ry, n.z) < 0.05 || phaseT >= 0.999) {
            n.x = n.rx; n.y = n.ry; n.z = 0;
            n.vx = 0; n.vy = 0; n.vz = 0;
            n.locked = true;
          }

        } else if (phase === "grid") {
          if (!n.locked) { n.x = n.rx; n.y = n.ry; n.z = 0; n.locked = true; }
          const noiseZ = (fbm2(n.rx * 0.6 + t * 0.10, n.ry * 0.6 + 2.7) - 0.5) * 0.08;
          n.x = n.rx + n.dx;
          n.y = n.ry + n.dy - scrollTiltY;
          n.z = n.dz + noiseZ;
          const K = 0.11, DAMP = 0.84;
          n.vx += -n.dx * K; n.vy += -n.dy * K; n.vz += -n.dz * K;
          n.vx *= DAMP; n.vy *= DAMP; n.vz *= DAMP;
          n.dx += n.vx; n.dy += n.vy; n.dz += n.vz;
          n.heat *= 0.964;

        } else if (phase === "dissolve") {
          if (dissolveExploding) {
            // Esplosione totale: outward dal centroide hotspot
            const odx = n.rx - dissolveOriginRx;
            const ody = n.ry - dissolveOriginRy;
            const olen = Math.sqrt(odx * odx + ody * ody) + 0.05;
            n.vx += (odx / olen) * 0.028;
            n.vy += (ody / olen) * 0.028;
            n.vz += (Math.random() - 0.5) * 0.018;
            n.vx *= 0.994; n.vy *= 0.994; n.vz *= 0.994;
            n.x += n.vx; n.y += n.vy; n.z += n.vz;
            n.heat = Math.min(1, n.heat + 0.025);
          } else if (dissolveElapsed < n.dissolveDelay) {
            // Vibrazione tensione pre-onda (rete che si tende prima di cedere)
            n.vx += (_hs(n.rx * 13.7 + t * 5.1) - 0.5) * 0.004;
            n.vy += (_hs(n.ry * 19.3 + t * 4.7 + 2.1) - 0.5) * 0.004;
            n.vx *= 0.90; n.vy *= 0.90;
            n.x += n.vx; n.y += n.vy;
          } else {
            // Slacken: deriva lenta dal centroide hotspot (rete che si slaccia)
            const odx = n.rx - dissolveOriginRx;
            const ody = n.ry - dissolveOriginRy;
            const olen = Math.sqrt(odx * odx + ody * ody) + 0.05;
            const outF = 0.0028; // forza piccola → deriva lenta, non esplosione
            const nx = (_hs(n.rx * 17.3 + t * 3.7) - 0.5) * 0.005;
            const ny = (_hs(n.ry * 31.1 + t * 4.3 + 7.1) - 0.5) * 0.005;
            n.vx += (odx / olen) * outF + nx;
            n.vy += (ody / olen) * outF + ny;
            n.vz += (_hs(n.rx * 7.1 + t * 2.3) - 0.5) * 0.006;
            n.vx *= 0.97; n.vy *= 0.97; n.vz *= 0.97;
            n.x += n.vx; n.y += n.vy; n.z += n.vz;
            n.heat = Math.min(1, n.heat + 0.008);
          }
        }
      }


      // ── Project all ───────────────────────────────────────────────────────────
      for (let i = 0; i < N_NODES; i++) {
        const n = nodes[i];
        projCache[i] = project(n.x, n.y, n.z, FL);
      }

      // ── Mouse force (grid only) ───────────────────────────────────────────────
      if (phase === "grid" && mX > 0) {
        for (let i = 0; i < N_NODES; i++) {
          const pr = projCache[i];
          if (!pr) continue;
          const dx = pr.sx - mX, dy = pr.sy - mY;
          const md = Math.sqrt(dx * dx + dy * dy);
          if (md < 170) {
            const proximity = (1 - md / 170) ** 2;
            const str = proximity * 0.024;
            nodes[i].vz += str * 1.6;
            nodes[i].dz = Math.min(nodes[i].dz, 0.42);
            nodes[i].heat = Math.min(1, nodes[i].heat + proximity * 0.11);
            if (md > 1) { nodes[i].vx += (dx / md) * str * 0.18; nodes[i].vy -= (dy / md) * str * 0.18; }
          }
        }
      }

      // ── Burn tracking + dissolve trigger ─────────────────────────────────────
      if (rawPhase === "grid" && !dissolveTriggered) {
        for (let i = 0; i < N_NODES; i++) {
          const n = nodes[i];
          if (n.heat > 0.70) {
            if (!n.wasHot) { n.burnCount++; n.wasHot = true; }
          } else if (n.heat < 0.25) {
            n.wasHot = false;
          }
        }

        let maxBurn = 0;
        for (let i = 0; i < N_NODES; i++) maxBurn = Math.max(maxBurn, nodes[i].burnCount);

        if (maxBurn >= 2) {
          dissolveTriggered = true;
          dissolveStartTs = ts;
          // Centroide dei nodi caldi = origine del laceramento
          let hcx = 0, hcy = 0, hc = 0;
          for (const n of nodes) {
            if (n.heat > 0.25) { hcx += n.rx; hcy += n.ry; hc++; }
          }
          if (hc > 0) { hcx /= hc; hcy /= hc; }
          dissolveOriginRx = hcx;
          dissolveOriginRy = hcy;
          const maxSpan = Math.sqrt(SPAN_X * SPAN_X + SPAN_Y * SPAN_Y) * 2;
          for (const n of nodes) {
            const dist = Math.hypot(n.rx - hcx, n.ry - hcy);
            n.dissolveDelay = (dist / maxSpan) * 0.9;
            // Kick immediato solo ai nodi caldi, direzione outward dal centroide
            if (n.heat > 0.25) {
              const dx = n.rx - hcx, dy = n.ry - hcy;
              const dlen = Math.sqrt(dx * dx + dy * dy) + 0.01;
              const str = 0.06 + n.heat * 0.18;
              n.vx += (dx / dlen) * str + (Math.random() - 0.5) * 0.03;
              n.vy += (dy / dlen) * str * 0.8 + (Math.random() - 0.5) * 0.03;
              n.vz += (Math.random() - 0.5) * str * 0.6;
            }
            n.locked = false;
          }
        }
      }

      // ── Dissolve → esplosione totale al 40% → ricostruzione al 78% ──────────
      if (phase === "dissolve") {
        let dissolvedCount = 0;
        for (const n of nodes) {
          if (Math.hypot(n.x - n.rx, n.y - n.ry) > 2.8) dissolvedCount++;
        }
        const dissolveRatio = dissolvedCount / N_NODES;

        // 40%: esplosione totale, kick outward dal centroide a tutti i nodi rimasti
        if (!dissolveExploding && dissolveRatio >= 0.4) {
          dissolveExploding = true;
          for (const n of nodes) {
            const odx = n.rx - dissolveOriginRx;
            const ody = n.ry - dissolveOriginRy;
            const olen = Math.sqrt(odx * odx + ody * ody) + 0.05;
            const str = 0.10 + Math.random() * 0.08;
            n.vx += (odx / olen) * str + (Math.random() - 0.5) * 0.04;
            n.vy += (ody / olen) * str + (Math.random() - 0.5) * 0.04;
            n.vz += (Math.random() - 0.5) * str * 0.8;
          }
        }

        // 78%: ricostruisce dalla fase converge
        if (dissolveExploding && dissolveRatio >= 0.78) {
          dissolveTriggered = false;
          dissolveExploding = false;
          dissolveStartTs = null;
          sustainedHeatFrames = 0;
          for (const n of nodes) {
            const rad = Math.cbrt(Math.random()) * 2.4;
            const θ = Math.random() * Math.PI * 2;
            const φ = Math.acos(2 * Math.random() - 1);
            n.x = rad * Math.sin(φ) * Math.cos(θ);
            n.y = rad * Math.sin(φ) * Math.sin(θ);
            n.z = (Math.random() - 0.5) * 2.5;
            n.vx = (Math.random() - 0.5) * 0.04;
            n.vy = (Math.random() - 0.5) * 0.04;
            n.vz = (Math.random() - 0.5) * 0.03;
            n.locked = false; n.heat = 0;
            n.dx = 0; n.dy = 0; n.dz = 0;
            n.burnCount = 0; n.wasHot = false; n.dissolveDelay = 0;
          }
          startRef.current = ts - (P1 + P_LETTER + 0.05) * 1000;
        }
      }

      // ── Idle wave ─────────────────────────────────────────────────────────────
      // mX is -9999 when no pointer; reset idle when pointer is inside canvas.
      if (phase === "grid" && !dissolveTriggered) {
        if (mX > 0 && mX < W && mY > 0 && mY < H) idleFrames = 0;
        else idleFrames++;
      } else {
        idleFrames = 0;
      }
      // Fade in after 2s idle, max amplitude 0.38 (subtle).
      const waveAmp = phase === "grid" && !dissolveTriggered
        ? Math.min(1, Math.max(0, idleFrames - 120) / 90) * 0.38
        : 0;

      // ── Draw ──────────────────────────────────────────────────────────────────
      ctx.globalCompositeOperation = "lighter";

      // --- Floating / letter / converging dots (nebula style) ---
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

          // Dissolve: nodi caldi → rosso arterioso
          if (phase === "dissolve" && n.heat > 0.3) {
            const heatNorm = Math.min(1, n.heat);
            r = Math.round(r + (ARTERIAL[0] - r) * heatNorm * 0.8);
            g = Math.round(g * (1 - heatNorm * 0.6));
            b = Math.round(b * (1 - heatNorm * 0.7));
          }

          let brightBoost = 1;
          if (phase === "letter" && n.letterTarget) {
            const dist = Math.hypot(n.x - n.letterTarget.wx, n.y - n.letterTarget.wy);
            brightBoost = dist < 0.25 ? 1.0 + (1 - dist / 0.25) * 1.4 : 1;
          }

          // Dissolve fade: nodi si dissolvono man mano che si allontanano dalla griglia
          let dissolveFade = 1;
          if (phase === "dissolve" && dissolveElapsed >= n.dissolveDelay) {
            const disp = Math.hypot(n.x - n.rx, n.y - n.ry);
            dissolveFade = Math.max(0, 1 - disp / 3.2);
            brightBoost = 1.0 + n.heat * 0.8;
          }

          const [baseSize, baseAlpha] = n.tier === 2 ? [0.014, 0.92] : n.tier === 1 ? [0.007, 0.58] : [0.003, 0.32];
          const szMult = phase === "letter" ? 1.1 : phase === "dissolve" ? Math.max(0.2, dissolveFade) * 1.2 : 1;
          const sz = Math.max(0.2, s * baseSize * szMult);
          const alpha = Math.min(1, baseAlpha * depthT * brightBoost * dissolveFade);
          if (alpha < 0.015) continue;

          ctx.fillStyle = `rgba(${r},${g},${b},${(alpha * 0.12).toFixed(4)})`;
          ctx.beginPath(); ctx.arc(sx, sy, sz * 3, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(4)})`;
          ctx.beginPath(); ctx.arc(sx, sy, sz, 0, Math.PI * 2); ctx.fill();
        }
      }

      // --- Grid lines ---
      if (phase === "converge" || phase === "grid" || phase === "dissolve") {
        ctx.lineCap = "round"; ctx.lineJoin = "round";

        const drawSeg = (i: number, j: number) => {
          const ni = nodes[i], nj = nodes[j];
          if (phase === "converge" && (!ni.locked || !nj.locked)) return;
          const a = projCache[i], b = projCache[j];
          if (!a || !b) return;

          const avgDz   = (ni.dz + nj.dz) * 0.5;
          const avgHeat = (ni.heat + nj.heat) * 0.5;
          // Linee scompaiono proporzionalmente al displacement dei nodi (non a timer)
          const dissolveLineFade = phase === "dissolve"
            ? Math.max(0, 1 - Math.hypot(ni.x - ni.rx, ni.y - ni.ry) / 2.2) *
              Math.max(0, 1 - Math.hypot(nj.x - nj.rx, nj.y - nj.ry) / 2.2)
            : 1;
          if (dissolveLineFade < 0.01) return;
          let r: number, g: number, bl: number;
          if (avgHeat > 0.01) {
            if (avgHeat > 0.65) {
              const f = (avgHeat - 0.65) / 0.35;
              r  = Math.round(ARTERIAL[0] + (255 - ARTERIAL[0]) * f);
              g  = Math.round(ARTERIAL[1] + (255 - ARTERIAL[1]) * f);
              bl = Math.round(ARTERIAL[2] + (255 - ARTERIAL[2]) * f);
            } else {
              const f = avgHeat / 0.65;
              r  = Math.round(COLD_BLUE[0] + (ARTERIAL[0] - COLD_BLUE[0]) * f);
              g  = Math.round(COLD_BLUE[1] + (ARTERIAL[1] - COLD_BLUE[1]) * f);
              bl = Math.round(COLD_BLUE[2] + (ARTERIAL[2] - COLD_BLUE[2]) * f);
            }
          } else {
            const t2 = Math.max(0, Math.min(1, avgDz * 1.8 + 0.45));
            if (t2 < 0.5) {
              const f = t2 * 2;
              r  = Math.round(DEEP_BLUE[0] + (COLD_BLUE[0] - DEEP_BLUE[0]) * f);
              g  = Math.round(DEEP_BLUE[1] + (COLD_BLUE[1] - DEEP_BLUE[1]) * f);
              bl = Math.round(DEEP_BLUE[2] + (COLD_BLUE[2] - DEEP_BLUE[2]) * f);
            } else {
              const f = (t2 - 0.5) * 2;
              r  = Math.round(COLD_BLUE[0] + (220 - COLD_BLUE[0]) * f);
              g  = Math.round(COLD_BLUE[1] + (228 - COLD_BLUE[1]) * f);
              bl = Math.round(COLD_BLUE[2] + (245 - COLD_BLUE[2]) * f);
            }
          }
          const disp  = Math.abs(avgDz);
          const avgRx = (ni.rx + nj.rx) * 0.5;
          const avgRy = (ni.ry + nj.ry) * 0.5;
          const wave  = waveAmp > 0 ? Math.max(0, Math.sin(avgRx * 1.1 + avgRy * 0.25 - t * 0.75)) * waveAmp : 0;
          const alpha = Math.min(0.92, 0.20 + disp * 2.6 + avgHeat * 0.5 + wave * 0.45) * dissolveLineFade;
          if (alpha < 0.01) return;
          const lw    = Math.min(3.2, 0.65 + disp * 5.5 + avgHeat * 1.8 + wave * 0.6);
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

        if (phase === "grid") {
          for (let i = 0; i < N_NODES; i++) {
            const pr = projCache[i];
            if (!pr) continue;
            const n = nodes[i];
            const dz = n.dz;
            const h = n.heat;
            const waveDot = waveAmp > 0 ? Math.max(0, Math.sin(n.rx * 1.1 + n.ry * 0.25 - t * 0.75)) * waveAmp : 0;
            if (dz < 0.18 && waveDot < 0.05) continue;
            const intensity = Math.min(1, (dz - 0.18) / 0.5);
            const dotR = h > 0.5 ? 255 : Math.round(COLD_BLUE[0] + (ARTERIAL[0] - COLD_BLUE[0]) * h * 2);
            const dotG = h > 0.5 ? Math.round(255 * (1 - (h - 0.5) * 1.4)) : Math.round(COLD_BLUE[1] + (ARTERIAL[1] - COLD_BLUE[1]) * h * 2);
            const dotB = h > 0.5 ? Math.round(255 * (1 - (h - 0.5) * 1.8)) : Math.round(COLD_BLUE[2] + (ARTERIAL[2] - COLD_BLUE[2]) * h * 2);
            const dotAlpha = Math.max(intensity, h) * 0.8 + waveDot * 0.3;
            ctx.fillStyle = `rgba(${dotR},${dotG},${dotB},${dotAlpha.toFixed(4)})`;
            ctx.beginPath(); ctx.arc(pr.sx, pr.sy, Math.max(0.4, intensity * 2.8 + waveDot * 1.2), 0, Math.PI * 2); ctx.fill();
          }
        }
      }

      // ── Post ──────────────────────────────────────────────────────────────────
      ctx.globalCompositeOperation = "source-over";
      const gd = ctx.createLinearGradient(0, H * 0.65, 0, H);
      gd.addColorStop(0, "rgba(0,0,0,0)");
      gd.addColorStop(1, `rgba(${BG[0]},${BG[1]},${BG[2]},1)`);
      ctx.fillStyle = gd; ctx.fillRect(0, 0, W, H);

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
