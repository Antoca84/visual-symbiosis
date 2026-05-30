import { useEffect, useRef } from "react";

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
  ix: number; iy: number;       // posizione iniziale grid (per misurare displacement)
  heat: number;
  dissolveDelay: number;        // delay per-nodo prima dello slacken
}

interface Seg {
  a: number; b: number;
  rest: number;
  on: boolean;
  ten: number;
}

function build(W: number, H: number) {
  const sx = W / (COLS - 1);
  const sy = (H * 0.65) / (ROWS - 1);
  const oy = H * 0.05;

  const pts: Pt[] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const x = c * sx, y = oy + r * sy;
      pts.push({
        x, y, px: x, py: y,
        pinned: r === 0 && c % 3 === 0,
        lx: x, ly: y, ld: Infinity,
        ix: x, iy: y,
        heat: 0, dissolveDelay: 0,
      });
    }

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

    // Dissolve state (come HeroGridNebula)
    let dissolveTriggered = false;
    let dissolveExploding = false;
    let dissolveOriginX = 0, dissolveOriginY = 0;
    let dissolveT = 0;

    const resize = () => {
      W = canvas.offsetWidth; H = canvas.offsetHeight;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const d = build(W, H); pts = d.pts; segs = d.segs;
      ready = false; t0 = null; letterPixels = [];
      dissolveTriggered = false; dissolveExploding = false; dissolveT = 0;
      sampleLetters(W, H).then(lp => {
        letterPixels = lp;
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
    const mm = (e: MouseEvent) => Object.assign(mou.current, pos(e));
    const md = (e: MouseEvent) => { mou.current.down = true; mm(e); };
    const mu = () => { mou.current.down = false; };
    window.addEventListener("mousemove", mm);
    canvas.addEventListener("mousedown", md);
    window.addEventListener("mouseup", mu);
    canvas.addEventListener("touchmove", (e) => {
      e.preventDefault();
      const p = pos(e.touches[0]);
      mou.current.x = p.x; mou.current.y = p.y;
    }, { passive: false });
    canvas.addEventListener("touchstart", (e) => {
      mou.current.down = true;
      const p = pos(e.touches[0]);
      mou.current.x = p.x; mou.current.y = p.y;
    });
    canvas.addEventListener("touchend", () => { mou.current.down = false; });

    let lastTs = 0;

    function frame(ts: number) {
      raf.current = requestAnimationFrame(frame);
      if (t0 === null) t0 = ts;
      const dt = Math.min((ts - lastTs) / 1000, 0.05);
      lastTs = ts;
      const el = (ts - t0) / 1000;
      const { x: mx, y: my, down } = mou.current;

      const phase = el < T_SETTLE ? 0
        : el < T_SETTLE + T_ATTRACT ? 1 : 2;
      const at = phase > 0 ? Math.min(1, (el - T_SETTLE) / T_ATTRACT) : 0;

      // ── Dissolve physics (stile HeroGridNebula) ───────────────────────
      if (dissolveTriggered) {
        dissolveT += dt;

        // Pre-wave + slacken (solo prima dell'esplosione)
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

        // Fisica base senza gravity
        for (const p of pts) {
          if (p.pinned) continue;
          const vx = (p.x - p.px) * DAMPING;
          const vy = (p.y - p.py) * DAMPING;
          p.px = p.x; p.py = p.y;
          p.x += vx; p.y += vy;
          p.heat *= 0.985;
        }

        // Explosion kick a 2.2s — una volta sola, poi i nodi volano per inerzia
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

        // Reconstruct a 6s dal trigger
        if (dissolveExploding && dissolveT >= 6.0) {
          const d = build(W, H);
          pts = d.pts; segs = d.segs;
          assignTargets(pts, letterPixels);
          dissolveTriggered = false;
          dissolveExploding = false;
          dissolveT = 0;
          t0 = null;
        }

        render(dissolveTriggered);
        return;
      }

      // ── Physics ───────────────────────────────────────────────────────
      for (const p of pts) {
        if (p.pinned) continue;
        const vx = (p.x - p.px) * DAMPING;
        const vy = (p.y - p.py) * DAMPING;
        p.px = p.x; p.py = p.y;
        p.x += vx; p.y += vy + GRAVITY;

        // Attrazione lettera
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

      // ── Pre-constraint tear ────────────────────────────────────────────
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
            if (Math.hypot(cmx - mx, cmy - my) < 55) s.on = false;
          }
        }
      }

      // ── Constraints ───────────────────────────────────────────────────
      for (let it = 0; it < ITER; it++) {
        for (const s of segs) {
          if (!s.on) continue;
          const pa = pts[s.a], pb = pts[s.b];
          const ddx = pa.x - pb.x, ddy = pa.y - pb.y;
          const dist = Math.sqrt(ddx * ddx + ddy * ddy) || 0.001;
          const tear = s.rest * TEAR_MULT;
          s.ten = Math.max(0, Math.min(1, (dist - s.rest) / (tear - s.rest)));
          if (dist > tear) { s.on = false; continue; }
          const diff = (dist - s.rest) / dist * 0.5;
          const ox = ddx * diff, oy = ddy * diff;
          if (!pa.pinned) { pa.x -= ox; pa.y -= oy; }
          if (!pb.pinned) { pb.x += ox; pb.y += oy; }
        }
      }

      // ── Dissolve trigger (40% segs rotti) ─────────────────────────────
      if (phase === 2 && ready && !dissolveTriggered) {
        let broken = 0;
        for (const s of segs) if (!s.on) broken++;
        if (broken / segs.length >= 0.25) {
          dissolveTriggered = true;
          dissolveT = 0;
          // Centroide nodi caldi
          let hcx = 0, hcy = 0, hc = 0;
          for (const p of pts) {
            if (!p.pinned && p.heat > 0.2) { hcx += p.x; hcy += p.y; hc++; }
          }
          dissolveOriginX = hc > 0 ? hcx / hc : W * 0.5;
          dissolveOriginY = hc > 0 ? hcy / hc : H * 0.45;
          const maxDist = Math.hypot(W, H);
          for (const p of pts) {
            p.px = p.x; p.py = p.y;  // azzera velocità Verlet
            p.ix = p.x; p.iy = p.y;  // snap riferimento displacement
            p.dissolveDelay = Math.hypot(p.x - dissolveOriginX, p.y - dissolveOriginY) / maxDist * 1.5;
          }
        }
      }

      render(false);
    }

    function render(inDissolve: boolean) {
      // Trail lungo durante dissolve, clear completo altrimenti
      if (inDissolve) {
        ctx.fillStyle = "rgba(11,13,20,0.06)";
      } else {
        ctx.fillStyle = "#0b0d14";
      }
      ctx.fillRect(0, 0, W, H);
      ctx.lineCap = "round";

      for (const s of segs) {
        if (!s.on) continue;
        const pa = pts[s.a], pb = pts[s.b];
        const h = Math.max(s.ten, (pa.heat + pb.heat) * 0.5);

        // Calore: blu → rosso → giallo → bianco (dal bordo verso il centro)
        let r: number, g: number, b: number;
        if (h > 0.72) {
          const f = (h - 0.72) / 0.28;
          r = 255; g = Math.round(210 + (255 - 210) * f); b = Math.round(255 * f);
        } else if (h > 0.38) {
          const f = (h - 0.38) / 0.34;
          r = 230; g = Math.round(40 + (210 - 40) * f); b = 0;
        } else if (h > 0.12) {
          const f = (h - 0.12) / 0.26;
          r = Math.round(58 + (230 - 58) * f);
          g = Math.round(134 * (1 - f));
          b = Math.round(214 * (1 - f));
        } else {
          r = 58; g = 134; b = 214;
        }

        const alpha = 0.28 + h * 0.68;
        const lw    = 0.45 + h * 2.1;

        if (h > 0.45) {
          ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
          ctx.strokeStyle = `rgba(${r},${g},${b},${(alpha * 0.18).toFixed(3)})`;
          ctx.lineWidth = lw * 5; ctx.stroke();
        }
        ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
        ctx.strokeStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
        ctx.lineWidth = lw; ctx.stroke();
      }

      // Pin nodes
      for (const p of pts) {
        if (!p.pinned) continue;
        ctx.fillStyle = "rgba(58,134,214,0.45)";
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill();
      }

      // Cursore: cerchio influenza + punto centrale
      const { x: cmx, y: cmy } = mou.current;
      if (cmx >= 0 && cmx <= W && cmy >= 0 && cmy <= H) {
        ctx.beginPath(); ctx.arc(cmx, cmy, MOUSE_R, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,0.18)";
        ctx.lineWidth = 1; ctx.stroke();
        ctx.beginPath(); ctx.arc(cmx, cmy, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.fill();
      }
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
