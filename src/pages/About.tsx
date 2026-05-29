import { motion } from "framer-motion";
import { useState } from "react";
import Navigation from "@/components/Navigation";
import ScrollReveal from "@/components/ScrollReveal";
import aboutImage from "@/assets/about-studio.jpg";
import { AboutImageOverlay } from "@/components/AboutImageOverlay";

const STEP_XY = 0.005;
const STEP_S  = 0.1;

const About = () => {
  const [ledX, setLedX]     = useState(0.215);
  const [ledY, setLedY]     = useState(0.720);
  const [ledS, setLedS]     = useState(1.0);
  const [lightsOn, setLightsOn] = useState(true);

  return (
    <main className="bg-background min-h-screen">
      <Navigation />

      <section className="pt-32 md:pt-44 px-6 md:px-12 pb-32 md:pb-48">
        <div>
          <div className="grid md:grid-cols-2 gap-16 md:gap-24 items-start">
            <ScrollReveal>
              <div className="space-y-8 md:py-4">
                <motion.p
                  className="text-[11px] tracking-[0.3em] uppercase text-muted-foreground"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
                >
                  About
                </motion.p>
                <p className="font-serif text-2xl md:text-3xl lg:text-4xl text-foreground/80 italic leading-[1.4]">
                  Industrial Magic is a VFX, CGI, and 3D studio. We create
                  visual content for cinema, commercial production, and
                  scientific communication — from fully rendered environments
                  to product visualization to phenomena made visible
                  for the first time.
                </p>
                <p className="font-serif text-xl md:text-2xl text-foreground/50 italic leading-[1.5]">
                  We work with directors who need a shot that doesn't exist yet.
                  With researchers who need their data to become something
                  people can actually see. With brands who need a visual
                  identity that doesn't look like everyone else's.
                </p>
                <p className="font-serif text-xl md:text-2xl text-foreground/50 italic leading-[1.5]">
                  Every project — regardless of scale — gets the same level
                  of craft. We work across cinematic VFX pipelines, 3D
                  workflows, and scientific visualization. We don't have
                  a good enough mode.
                </p>
                <p className="font-serif text-xl md:text-2xl text-foreground/50 italic leading-[1.5]">
                  High-end visual production has historically required
                  high-end budgets. We built this studio to challenge that.
                  The craft stays. The ceiling moves.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.2}>
              <div className="w-full overflow-hidden aspect-[4/5] relative">
                <img
                  src={aboutImage}
                  alt="Industrial Magic studio"
                  className="w-full h-full object-cover object-center"
                  loading="lazy"
                />
                <AboutImageOverlay
                  ledX={ledX}
                  ledY={ledY}
                  ledScale={ledS}
                  lightsOn={lightsOn}
                />
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── DEBUG PANEL (rimuovere dopo calibrazione) ── */}
      <div className="hidden md:flex fixed bottom-4 right-4 z-50 flex-col gap-1 bg-black/80 border border-white/10 rounded p-3 text-[10px] font-mono text-white/70 select-none">
        <div className="text-white/40 mb-1 tracking-widest uppercase text-[9px]">LED debug</div>

        {/* X */}
        <div className="flex items-center gap-2">
          <span className="w-4">X</span>
          <button onClick={() => setLedX(v => +(v - STEP_XY).toFixed(3))} className="px-2 py-0.5 bg-white/10 hover:bg-white/20 rounded">−</button>
          <span className="w-12 text-center">{ledX.toFixed(3)}</span>
          <button onClick={() => setLedX(v => +(v + STEP_XY).toFixed(3))} className="px-2 py-0.5 bg-white/10 hover:bg-white/20 rounded">+</button>
        </div>

        {/* Y */}
        <div className="flex items-center gap-2">
          <span className="w-4">Y</span>
          <button onClick={() => setLedY(v => +(v - STEP_XY).toFixed(3))} className="px-2 py-0.5 bg-white/10 hover:bg-white/20 rounded">−</button>
          <span className="w-12 text-center">{ledY.toFixed(3)}</span>
          <button onClick={() => setLedY(v => +(v + STEP_XY).toFixed(3))} className="px-2 py-0.5 bg-white/10 hover:bg-white/20 rounded">+</button>
        </div>

        {/* Z (scale) */}
        <div className="flex items-center gap-2">
          <span className="w-4">Z</span>
          <button onClick={() => setLedS(v => +(v - STEP_S).toFixed(1))} className="px-2 py-0.5 bg-white/10 hover:bg-white/20 rounded">−</button>
          <span className="w-12 text-center">{ledS.toFixed(1)}</span>
          <button onClick={() => setLedS(v => +(v + STEP_S).toFixed(1))} className="px-2 py-0.5 bg-white/10 hover:bg-white/20 rounded">+</button>
        </div>

        {/* Toggle luci */}
        <button
          onClick={() => setLightsOn(v => !v)}
          className={`mt-2 px-2 py-1 rounded text-[9px] tracking-widest uppercase transition-colors ${lightsOn ? "bg-white/20 text-white" : "bg-white/5 text-white/30"}`}
        >
          {lightsOn ? "Luci ON" : "Luci OFF"}
        </button>
      </div>
    </main>
  );
};

export default About;
