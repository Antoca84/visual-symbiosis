import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { HeroGridNebula } from "@/components/HeroGridNebula";

const HeroSection = () => {
  const sectionRef = useRef<HTMLElement>(null);
  
  // Track scroll progress within the hero section
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"]
  });

  // Title fades out as user scrolls past hero
  const textOpacity = useTransform(scrollYProgress, [0.45, 0.85], [1, 0]);

  return (
    <section 
      ref={sectionRef}
      className="relative h-screen w-full overflow-hidden flex items-end pb-16 md:pb-24"
    >
      {/* Nebula → grid assembly canvas */}
      <HeroGridNebula scrollYProgress={scrollYProgress} />

      {/* Studio name with subtle cinematic focus-based reveal */}
      <div className="relative z-10 px-6 md:px-12 w-full">
        <div className="border-l border-foreground/20 pl-4 md:pl-6 inline-block mb-3 md:mb-4">
          <span className="text-[9px] tracking-[0.35em] uppercase text-foreground/25">
            Visual Laboratory
          </span>
        </div>
        <motion.h1
          className="font-serif text-5xl md:text-7xl lg:text-[8rem] xl:text-[10rem] leading-[0.85] tracking-[0.04em] text-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            duration: 1.0,
            delay: 3.0,
            ease: [0.25, 0.1, 0.25, 1],
          }}
          style={{ opacity: textOpacity }}
        >
          Industrial
          <br />
          Magic
        </motion.h1>
        <motion.p
          className="mt-6 text-[11px] tracking-[0.3em] uppercase text-muted-foreground border-l border-foreground/10 pl-4 md:pl-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 3.8, ease: "easeOut" }}
        >
          VFX, CGI, and 3D at the intersection of technical precision
          and artistic vision. We make the extraordinary, for everyone.
        </motion.p>
      </div>
    </section>
  );
};

export default HeroSection;
