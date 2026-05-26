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
                  Industrial Magic is a visual studio at the intersection of
                  VFX, CGI, 3D, cinema, and scientific visualization.
                  We build extraordinary visual worlds — with the precision
                  of engineering and the intention of art.
                </p>
                <p className="font-serif text-xl md:text-2xl text-foreground/50 italic leading-[1.5]">
                  We do not automate craft. We do not render by default.
                  Every image is authored — felt, not merely processed.
                </p>
                <p className="font-serif text-xl md:text-2xl text-foreground/50 italic leading-[1.5]">
                  The studio works across cinematic VFX pipelines, fully 3D
                  workflows, and scientific visualization — treating each domain
                  not as a deliverable, but as a question asked in light,
                  volume, and time.
                </p>
                <p className="font-serif text-xl md:text-2xl text-foreground/50 italic leading-[1.5]">
                  Exceptional quality is not a privilege reserved for
                  exceptional budgets. That is exactly what we are here to prove.
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
