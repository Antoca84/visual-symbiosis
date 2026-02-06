import { motion } from "framer-motion";
import heroImage from "@/assets/hero-biology.jpg";

const HeroSection = () => {
  return (
    <section className="relative h-screen w-full overflow-hidden flex items-end pb-16 md:pb-24">
      {/* Background image with slow reveal */}
      <motion.div
        className="absolute inset-0"
        initial={{ scale: 1.15, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 2.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <img
          src={heroImage}
          alt="Biological visual interpretation — Industrial Magic"
          className="w-full h-full object-cover"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      </motion.div>

      {/* Studio name */}
      <div className="relative z-10 px-6 md:px-12 w-full">
        <motion.h1
          className="font-serif text-5xl md:text-7xl lg:text-[8rem] xl:text-[10rem] leading-[0.85] tracking-[0.04em] text-foreground"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 1.4,
            delay: 1.6,
            ease: [0.25, 0.1, 0.25, 1],
          }}
        >
          Industrial
          <br />
          Magic
        </motion.h1>
        <motion.p
          className="mt-6 text-[11px] tracking-[0.3em] uppercase text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 2.4, ease: "easeOut" }}
        >
          A visual laboratory at the intersection of biology, graphic-novel
          language, and cinematic VFX.
        </motion.p>
      </div>
    </section>
  );
};

export default HeroSection;
