import { motion } from "framer-motion";
import Navigation from "@/components/Navigation";
import ScrollReveal from "@/components/ScrollReveal";
import aboutImage from "@/assets/about-studio.jpg";

const About = () => {
  return (
    <main className="bg-background min-h-screen">
      <Navigation />

      <section className="pt-32 md:pt-44 px-6 md:px-12 pb-32 md:pb-48">
        <div className="max-w-screen-xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <p className="text-[11px] tracking-[0.3em] uppercase text-muted-foreground mb-8">
              About
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-16 md:gap-24 items-start">
            <ScrollReveal>
              <div className="space-y-8">
                <p className="font-serif text-2xl md:text-3xl lg:text-4xl text-foreground/80 italic leading-[1.4]">
                  Industrial Magic is a visual laboratory operating at the
                  intersection of biology, graphic-novel language, and conceptual
                  scientific art.
                </p>
                <p className="font-serif text-xl md:text-2xl text-foreground/50 italic leading-[1.5]">
                  We do not explain. We interpret. Our work exists to give
                  scientific phenomena a visual voice — one that is authored, not
                  automated; felt, not merely understood.
                </p>
                <p className="font-serif text-xl md:text-2xl text-foreground/50 italic leading-[1.5]">
                  The practice includes both illustrated and fully 3D
                  VFX-driven workflows, borrowing tools from cinematic visual
                  effects when interpretation demands it.
                </p>
                <p className="font-serif text-xl md:text-2xl text-foreground/50 italic leading-[1.5]">
                  Every image is a position. Every project is a question asked in
                  form rather than language.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.2}>
              <div className="md:mt-16">
                <img
                  src={aboutImage}
                  alt="Industrial Magic studio"
                  className="w-full object-cover"
                  style={{ aspectRatio: "3/4" }}
                  loading="lazy"
                />
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>
    </main>
  );
};

export default About;
