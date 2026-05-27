import { motion } from "framer-motion";
import Navigation from "@/components/Navigation";
import ScrollReveal from "@/components/ScrollReveal";
import aboutImage from "@/assets/about-studio.png";

const About = () => {
  return (
    <main className="bg-background min-h-screen">
      <Navigation />

      <section className="pt-32 md:pt-44 px-6 md:px-12 pb-32 md:pb-48">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <p className="text-[11px] tracking-[0.3em] uppercase text-muted-foreground mb-8">
              About
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-16 md:gap-24 items-center">
            <ScrollReveal>
              <div className="space-y-8">
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
              <div>
                <div className="w-full overflow-hidden" style={{ aspectRatio: "3/4" }}>
                  <img
                    src={aboutImage}
                    alt="Industrial Magic studio"
                    className="w-full object-cover"
                    style={{ height: "calc(100% + 3cm)", marginTop: "-2cm" }}
                    loading="lazy"
                  />
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>
    </main>
  );
};

export default About;
