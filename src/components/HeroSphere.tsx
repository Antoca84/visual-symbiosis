import { useEffect, useRef } from "react";
import { MotionValue } from "framer-motion";

// ─── Noise helpers ────────────────────────────────────────────────────────────
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
function fbm(x: number, y: number, z: number, o = 4): number {
  let v=0,a=.5,f=1;
  for(let i=0;i<o;i++){v+=a*vnoise(x*f,y*f,z*f);a*=.5;f*=2;}
  return v;
}

// ─── Colour helpers ───────────────────────────────────────────────────────────
type RGB = [number, number, number];
const lp = (a: number, b: number, t: number) => a + t*(b-a);
const mix = (c1: RGB, c2: RGB, t: number): RGB =>
  c1.map((v,i) => Math.round(lp(v, c2[i], Math.max(0,Math.min(1,t))))) as RGB;
const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(4)})`;

const BG:   RGB = [12,14,20];
const BONE: RGB = [221,213,192];
const DB:   RGB = [26,64,102];
const CB:   RGB = [58,134,214];

// ─── Geometry (built once, outside component) ─────────────────────────────────
const N = 650;
const golden = Math.PI*(3-Math.sqrt(5));
const [cXr,sXr,cYr,sYr] = [Math.cos(.18),Math.sin(.18),Math.cos(.30),Math.sin(.30)];

interface SphereNode {
  x: number; y: number; z: number;
  sx: number; sy: number;
  lift: number; dp: number;
}

function buildSphere(): { nodes: SphereNode[], edges: [number,number][] } {
  const nodes: SphereNode[] = [];
  for(let i=0;i<N;i++){
    const y0=1-(i/(N-1))*2, r0=Math.sqrt(Math.max(0,1-y0*y0)), phi=golden*i;
    let ox=Math.cos(phi)*r0, oy=y0, oz=Math.sin(phi)*r0;
    const d=1+(fbm(ox*2.0+3.1,oy*2.0+6.8,oz*2.0+1.4,3)-.5)*.26;
    ox*=d; oy*=d; oz*=d;
    const x1=ox*cYr+oz*sYr, z1=-ox*sYr+oz*cYr;
    nodes.push({ x:x1, y:oy*cXr-z1*sXr, z:oy*sXr+z1*cXr, sx:0, sy:0, lift:0, dp:0 });
  }
  nodes.sort((a,b)=>a.z-b.z);
  const edges: [number,number][] = [];
  const seen: Record<string,boolean> = {};
  for(let i=0;i<N;i++){
    const ni=nodes[i];
    nodes.map((nj,j)=>({j,d:Math.hypot(ni.x-nj.x,ni.y-nj.y,ni.z-nj.z)}))
      .sort((a,b)=>a.d-b.d).slice(1,6)
      .forEach(({j})=>{const k=`${Math.min(i,j)},${Math.max(i,j)}`;if(!seen[k]){seen[k]=true;edges.push([i,j]);}});
  }
  return { nodes, edges };
}

const { nodes, edges } = buildSphere();

const coronaRays = Array.from({length:28},()=>{
  const r=Math.random();
  return { a:Math.random()*Math.PI*2, len:r, w:0.4+r*.8, op:0.08+r*.10 };
});

// ─── Component ────────────────────────────────────────────────────────────────
interface HeroSphereProps {
  scrollYProgress: MotionValue<number>;
}

export function HeroSphere({ scrollYProgress }: HeroSphereProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef  = useRef({ x: -9999, y: -9999 });
  const stateRef  = useRef({ rotAngle: 0, rotSpeed: 3e-4 });
  const rafRef    = useRef<number>(0);
  const scrollRef = useRef(0);

  useEffect(() => scrollYProgress.on("change", v => { scrollRef.current = v; }), [scrollYProgress]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext('2d')!;
    let W = 0, H = 0;

    const resize = () => {
      W = canvas.width  = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX-rect.left, y: e.clientY-rect.top };
    };
    const onMouseLeave = () => { mouseRef.current = { x:-9999, y:-9999 }; };
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', onMouseLeave);

    function rg(x:number,y:number,r:number,stops:[number,string][]) {
      const g = ctx.createRadialGradient(x,y,0,x,y,r);
      stops.forEach(([t,c])=>g.addColorStop(t,c));
      ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    }

    function draw() {
      rafRef.current = requestAnimationFrame(draw);
      const SC = Math.min(W,H)*.56;
      const CX = W*.50, CY = H*.46;
      const INFLUENCE = 140, LIFT_Z = 0.40;

      const sp = Math.min(1, scrollRef.current / .75);
      const targetSpeed = 3e-4 + sp * 14e-4;
      stateRef.current.rotSpeed += (targetSpeed - stateRef.current.rotSpeed) * 0.04;
      stateRef.current.rotAngle += stateRef.current.rotSpeed;
      const cosR = Math.cos(stateRef.current.rotAngle);
      const sinR = Math.sin(stateRef.current.rotAngle);
      const { x: mX, y: mY } = mouseRef.current;

      for(const n of nodes){
        const rx =  n.x*cosR + n.z*sinR;
        const ry =  n.y;
        const rz = -n.x*sinR + n.z*cosR;
        n.sx = CX + rx*SC;
        n.sy = CY - ry*SC;
        const dist = Math.hypot(n.sx-mX, n.sy-mY);
        const t    = Math.max(0, 1-dist/INFLUENCE);
        const tgt  = t*t*(3-2*t);
        n.lift += (tgt - n.lift) * (tgt > n.lift ? 0.085 : 0.055);
        n.dp = Math.max(0,((rz+n.lift*LIFT_Z)+1.3)/2.6);
      }

      ctx.fillStyle = rgba(BG,1); ctx.fillRect(0,0,W,H);
      { const g=ctx.createRadialGradient(W*.5,H*.42,0,W*.5,H*.42,W*.55);
        g.addColorStop(0,'rgba(18,30,58,0.32)'); g.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=g; ctx.fillRect(0,0,W,H); }

      for(const [i,j] of edges){
        const ni=nodes[i],nj=nodes[j];
        const ad=(ni.dp+nj.dp)/2;
        if(ad<.07) continue;
        const avgLift=(ni.lift+nj.lift)/2;
        ctx.beginPath(); ctx.moveTo(ni.sx,ni.sy); ctx.lineTo(nj.sx,nj.sy);
        ctx.strokeStyle=rgba(mix(DB,BONE,ad), ad*.38+avgLift*.12);
        ctx.lineWidth=.25+ad*.65+avgLift*.40; ctx.stroke();
      }

      for(const n of nodes){
        if(n.dp<.07) continue;
        const sz=(1.0+n.dp*3.8)*(1+n.lift*.60);
        const col=mix(mix(DB,BONE,n.dp),BONE,n.lift*.42);
        ctx.fillStyle=rgba(col, n.dp*.90+n.lift*.08);
        ctx.beginPath(); ctx.arc(n.sx,n.sy,sz,0,Math.PI*2); ctx.fill();
        ctx.fillStyle=rgba(mix(DB,CB,n.dp*.5), n.dp*.18+n.lift*.14);
        ctx.beginPath(); ctx.arc(n.sx,n.sy,sz*4.5,0,Math.PI*2); ctx.fill();
      }

      ctx.globalCompositeOperation='screen';
      rg(CX,CY,SC*.55,[[0,'rgba(148,144,130,0.18)'],[.5,'rgba(52,88,148,0.07)'],[1,'rgba(0,0,0,0)']]);
      const klx=CX-SC*.28, kly=CY-SC*.36;
      rg(klx,kly,SC*.82,[[0,'rgba(218,212,194,0.22)'],[.30,'rgba(90,148,230,0.06)'],[1,'rgba(0,0,0,0)']]);
      ctx.lineCap='round';
      coronaRays.forEach(({a,len,w,op})=>{
        const rl=SC*(.05+len*.15);
        ctx.beginPath(); ctx.moveTo(klx,kly); ctx.lineTo(klx+Math.cos(a)*rl,kly+Math.sin(a)*rl);
        ctx.strokeStyle=`rgba(215,210,192,${op.toFixed(3)})`; ctx.lineWidth=w; ctx.stroke();
      });
      rg(CX+SC*.10,CY+SC*.28,SC*.58,[[0,'rgba(147,37,37,0.26)'],[1,'rgba(0,0,0,0)']]);
      if(mX>0){ const cg=ctx.createRadialGradient(mX,mY,0,mX,mY,72);
        cg.addColorStop(0,'rgba(205,200,182,0.07)'); cg.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=cg; ctx.fillRect(0,0,W,H); }
      ctx.globalCompositeOperation='source-over';

      { const g=ctx.createLinearGradient(0,H*.46,0,H);
        g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(7,9,17,0.98)');
        ctx.fillStyle=g; ctx.fillRect(0,0,W,H); }
      rg(W/2,H/2,W*.72,[[0,'rgba(0,0,0,0)'],[.55,'rgba(7,9,17,0.24)'],[1,'rgba(7,9,17,0.98)']]);
    }

    draw();
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseleave', onMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ display:'block' }}
    />
  );
}
