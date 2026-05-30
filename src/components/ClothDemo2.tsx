import { useEffect, useRef } from "react";

const COLS = 60;
const ROWS = 28;
const GRAVITY = 0.22;
const DAMPING = 0.985;
const ITER = 6;
const MOUSE_R = 60;
const TEAR_MULT = 1.5;

const T_SETTLE  = 1.2;
const T_ATTRACT = 2.8;

// Rebuild timing (secondi relativi)
const REBUILD_BURST   = 0.7;   // burst outward
const REBUILD_REFORM  = 1.8;   // convergenza verso lettere
const REBUILD_TOTAL   = REBUILD_BURST + REBUILD_REFORM;

interface Pt {
  x: number; y: number;
  px: number; py: number;
  pinned: boolean;
  lx: number; ly: number;
  ld: number;
  heat: number;
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
      pts.push({ x, y, px: x, py: y,
        pinned: r === 0 && c % 3 === 0,
        lx: x, ly: y, ld: Infinity, heat: 0 });
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
    let rebuilding = false;
    let rebuildElapsed = 0;   // secondi dall'inizio rebuild
    let totalSegs = 0;
    let burstApplied = false; // impulso outward applicato una volta sola

    const resize = () => {
      W = canvas.offsetWidth; H = canvas.offsetHeight;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const d = build(W, H); pts = d.pts; segs = d.segs;
      totalSegs = segs.length;
      ready = false; t0 = null;
      rebuilding = false; rebuildElapsed = 0; burstApplied = false;
      sampleLetters(W, H).then(lp => { assignTargets(pts, lp); ready = true; });
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
    canvas.addEventListener("mousemove", mm);
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
      const dt = Math.min((ts - lastTs) / 1000, 0.05); // cap dt
      lastTs = ts;
      const el = (ts - t0) / 1000;
      const { x: mx, y: my, down } = mou.current;

      const phase = el < T_SETTLE ? 0
        : el < T_SETTLE + T_ATTRACT ? 1 : 2;
      const at = phase > 0 ? Math.min(1, (el - T_SETTLE) / T_ATTRACT) : 0;

      // ── Rebuild ───────────────────────────────────────────────────────
      if (rebuilding) {
        rebuildElapsed += dt;

        if (!burstApplied) {
          // Impulso outward + random — una volta sola all'inizio
          burstApplied = true;
          for (const s of segs) s.on = false;
          for (const p of pts) {
            if (p.pinned) continue;
            const angle = Math.random() * Math.PI * 2;
            const spd = 3 + Math.random() * 5;
            // Modifica px/py per iniettare velocità Verlet
            p.px -= Math.cos(angle) * spd;
            p.py -= Math.sin(angle) * spd;
            p.heat = Math.min(1, p.heat + 0.6);
          }
        }

        if (rebuildElapsed > REBUILD_BURST) {
          // Fase convergenza: attrazione forte verso target lettera
          const reformT = Math.min(1, (rebuildElapsed - REBUILD_BURST) / REBUILD_REFORM);
          const str = reformT * reformT * 0.30;
          for (const p of pts) {
            if (p.pinned) continue;
            const ddx = p.lx - p.x, ddy = p.ly - p.y;
            p.x += ddx * str;
            p.y += ddy * str;
            p.px += ddx * str * 0.5;
            p.py += ddy * str * 0.5;
            // Cancella gravity durante la convergenza
            p.y -= GRAVITY * reformT;
          }
          // Ri-abilita segmenti quando i nodi si riavvicinano
          for (const s of segs) {
            if (s.on) continue;
            const pa = pts[s.a], pb = pts[s.b];
            if (Math.hypot(pa.x - pb.x, pa.y - pb.y) < s.rest * 1.2) {
              s.on = true; s.ten = 0;
            }
          }
        }

        if (rebuildElapsed >= REBUILD_TOTAL) {
          rebuilding = false;
          rebuildElapsed = 0;
          burstApplied = false;
          // Snap finale: letter nodes sulla target, azzera velocità
          for (const p of pts) {
            if (p.pinned) continue;
            if (p.ld < 28) { p.x = p.lx; p.y = p.ly; }
            p.px = p.x; p.py = p.y;
          }
        }

        // Applica constraints e renderizza (niente mouse durante rebuild)
        applyConstraints();
        render(phase);
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
            // Controgravità proporzionale all'attraction — nodi lettera tengono posizione
            p.y -= GRAVITY * Math.min(1, str / 0.20) * heatMask;
            p.px += ddx * str * 0.58;
            p.py += ddy * str * 0.58;
          } else if (phase === 1) {
            // Fase formazione: piccola extra gravity per separare non-lettera
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
            p.x += ddx * inv * prox * 2.0;
            p.y += ddy * inv * prox * 2.0;
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
            if (Math.hypot(cmx - mx, cmy - my) < 18) s.on = false;
          }
        }
      }

      applyConstraints();

      // ── Rebuild trigger ────────────────────────────────────────────────
      if (phase === 2 && ready && totalSegs > 0) {
        let broken = 0;
        for (const s of segs) if (!s.on) broken++;
        if (broken / totalSegs >= 0.25) {
          rebuilding = true;
          rebuildElapsed = 0;
          burstApplied = false;
        }
      }

      render(phase);
    }

    function applyConstraints() {
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
    }

    function render(phase: number) {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#0b0d14";
      ctx.fillRect(0, 0, W, H);
      ctx.lineCap = "round";

      for (const s of segs) {
        if (!s.on) continue;
        const pa = pts[s.a], pb = pts[s.b];
        const h = Math.max(s.ten, (pa.heat + pb.heat) * 0.5);

        let r: number, g: number, b: number;
        if (h > 0.65) {
          const f = (h - 0.65) / 0.35;
          r = Math.round(147 + (255 - 147) * f);
          g = Math.round(37 * (1 - f * 0.7));
          b = Math.round(37 * (1 - f * 0.9));
        } else if (h > 0.2) {
          const f = (h - 0.2) / 0.45;
          r = Math.round(58 + (147 - 58) * f);
          g = Math.round(134 + (37 - 134) * f);
          b = Math.round(214 + (37 - 214) * f);
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

      // Nodi sciolti durante rebuild (burst): puntini glowing
      if (rebuilding && !segs.some(s => s.on)) {
        for (const p of pts) {
          if (p.pinned) continue;
          const h = p.heat;
          let r = 58, g = 134, b = 214;
          if (h > 0.5) { r = 200; g = 60; b = 60; }
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.5 + h * 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r},${g},${b},${0.4 + h * 0.5})`;
          ctx.fill();
        }
      }

      // Pin nodes
      for (const p of pts) {
        if (!p.pinned) continue;
        ctx.fillStyle = "rgba(58,134,214,0.45)";
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill();
      }

      // Debug HUD
      if (phase === 2) {
        let broken = 0; for (const s of segs) if (!s.on) broken++;
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.font = "11px monospace";
        ctx.fillText(`ph:${phase} rdy:${ready} torn:${(broken/totalSegs*100).toFixed(0)}% rebuild:${rebuilding}`, 10, H - 12);
      }
    }

    raf.current = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mouseup", mu);
    };
  }, []);

  return (
    <canvas
      ref={cvs}
      className="absolute inset-0 w-full h-full block cursor-crosshair"
      style={{ touchAction: "none" }}
    />
  );
}
