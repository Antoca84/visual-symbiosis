import { useEffect, useRef } from "react";

const COLS = 60;
const ROWS = 28;
const GRAVITY = 0.13;
const DAMPING = 0.986;
const ITER    = 6;
const MOUSE_R = 90;
const TEAR_MULT = 1.8;

const T_SETTLE  = 1.4;
const T_ATTRACT = 3.0;

interface Pt {
  x: number; y: number;
  px: number; py: number;
  pinned: boolean;
  lx: number; ly: number;  // letter target screen coords
  ld: number;              // distanza dal target lettera
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
  const sy = (H * 0.70) / (ROWS - 1);
  const ox = 0, oy = H * 0.04;

  const pts: Pt[] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const x = ox + c * sx, y = oy + r * sy;
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
  const cy = H * 0.44;
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
    let rebuildT = 0;
    let totalSegs = 0;

    const resize = () => {
      W = canvas.offsetWidth; H = canvas.offsetHeight;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.scale(dpr, dpr);
      const d = build(W, H); pts = d.pts; segs = d.segs;
      totalSegs = segs.length;
      ready = false; t0 = null; rebuilding = false; rebuildT = 0;
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

    function frame(ts: number) {
      raf.current = requestAnimationFrame(frame);
      if (t0 === null) t0 = ts;
      const el = (ts - t0) / 1000;
      const { x: mx, y: my, down } = mou.current;

      const phase = el < T_SETTLE ? 0
        : el < T_SETTLE + T_ATTRACT ? 1 : 2;
      const at = phase > 0 ? Math.min(1, (el - T_SETTLE) / T_ATTRACT) : 0;

      // ── Physics ───────────────────────────────────────────────────────
      for (const p of pts) {
        if (p.pinned) continue;
        const vx = (p.x - p.px) * DAMPING;
        const vy = (p.y - p.py) * DAMPING;
        p.px = p.x; p.py = p.y;
        p.x += vx; p.y += vy + GRAVITY;

        // Attrazione lettera / extra-gravity fuori lettera
        if (ready && at > 0.04) {
          const t = Math.max(0, at - 0.04) / 0.96;
          const isLetter = p.ld < 18;
          if (isLetter) {
            // Forza forte verso target + cancella gravity gradualmente
            // heatMask: mouse caldo azzera attraction → permette strappo
            const heatMask = Math.max(0, 1 - p.heat * 4);
            const str = Math.min(0.32, t * t * 0.38) * heatMask;
            const dx = p.lx - p.x, dy = p.ly - p.y;
            p.x += dx * str;
            p.y += dy * str;
            // Cancella gravity proporzionalmente all'attrazione
            p.y -= GRAVITY * Math.min(1, t * 2);
            // Smorza velocità Verlet verso target
            p.px += dx * str * 0.5;
            p.py += dy * str * 0.5;
          } else {
            // Non-lettera: extra gravity — cade più in fretta
            const extraG = Math.min(0.7, t * t * p.ld * 0.0045);
            p.y += extraG;
          }
        }

        // Mouse
        const dx = p.x - mx, dy = p.y - my;
        const md2 = Math.sqrt(dx * dx + dy * dy);
        if (md2 < MOUSE_R) {
          const prox = (1 - md2 / MOUSE_R);
          if (down) {
            // Pull verso mouse → stira → strappa
            p.x += (mx - p.x) * prox * 0.40;
            p.y += (my - p.y) * prox * 0.40;
          } else {
            // Push outward → arriccia la tela
            const inv = 1 / (md2 || 0.001);
            p.x += dx * inv * prox * 2.2;
            p.y += dy * inv * prox * 2.2;
          }
          p.heat = Math.min(1, p.heat + prox * 0.12);
        } else {
          p.heat *= 0.94;
        }
      }

      // ── Constraints ───────────────────────────────────────────────────
      for (let it = 0; it < ITER; it++) {
        for (const s of segs) {
          if (!s.on) continue;
          const pa = pts[s.a], pb = pts[s.b];
          const dx = pa.x - pb.x, dy = pa.y - pb.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
          const tear = s.rest * TEAR_MULT;
          s.ten = Math.max(0, Math.min(1, (dist - s.rest) / (tear - s.rest)));
          if (dist > tear) { s.on = false; continue; }
          const diff = (dist - s.rest) / dist * 0.5;
          const ox = dx * diff, oy = dy * diff;
          if (!pa.pinned) { pa.x -= ox; pa.y -= oy; }
          if (!pb.pinned) { pb.x += ox; pb.y += oy; }
        }
      }

      // ── Rebuild trigger + laser physics ──────────────────────────────
      if (phase === 2 && ready && totalSegs > 0) {
        const brokenCount = segs.reduce((n, s) => n + (s.on ? 0 : 1), 0);
        if (!rebuilding && brokenCount / totalSegs >= 0.40) {
          rebuilding = true;
          rebuildT = 0;
        }
      }
      if (rebuilding) {
        rebuildT = Math.min(1, rebuildT + 0.007);
        const laserX = rebuildT * W;
        for (const s of segs) {
          const midX = (pts[s.a].x + pts[s.b].x) * 0.5;
          if (!s.on && midX < laserX) {
            s.on = true;
            for (const idx of [s.a, s.b]) {
              const p = pts[idx];
              if (!p.pinned) {
                p.x += (p.lx - p.x) * 0.25;
                p.y += (p.ly - p.y) * 0.25;
                p.px = p.x; p.py = p.y;
              }
            }
          }
        }
        if (rebuildT >= 1) rebuilding = false;
      }

      // ── Draw ──────────────────────────────────────────────────────────
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

      // Pin nodes
      for (const p of pts) {
        if (!p.pinned) continue;
        ctx.fillStyle = "rgba(58,134,214,0.45)";
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill();
      }

      // Laser rebuild sweep
      if (rebuilding) {
        const laserX = rebuildT * W;
        const grad = ctx.createLinearGradient(laserX - 40, 0, laserX + 8, 0);
        grad.addColorStop(0, "rgba(58,134,214,0)");
        grad.addColorStop(0.65, "rgba(120,200,255,0.30)");
        grad.addColorStop(1, "rgba(200,240,255,0.80)");
        ctx.fillStyle = grad;
        ctx.fillRect(laserX - 40, 0, 48, H);
        ctx.beginPath();
        ctx.moveTo(laserX, 0); ctx.lineTo(laserX, H);
        ctx.strokeStyle = "rgba(200,240,255,0.92)";
        ctx.lineWidth = 1.5; ctx.stroke();
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
