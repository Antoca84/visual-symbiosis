import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { ClothDemo2 } from "@/components/ClothDemo2";

const HeroSection = () => {
  const sectionRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"]
  });

  const textOpacity = useTransform(scrollYProgress, [0.45, 0.85], [1, 0]);

  return (
    <section
      ref={sectionRef}
      className="relative h-svh md:h-screen w-full overflow-hidden flex items-center md:items-end md:pb-24"
    >
      <ClothDemo2 showHud={false} />

      <div className="relative z-10 px-6 md:px-12 w-full pointer-events-none">
        <div className="border-l border-foreground/20 pl-4 md:pl-6 inline-block mb-3 md:mb-4">
          <span className="text-[9px] tracking-[0.35em] uppercase text-foreground/25">
            Visual Laboratory
          </span>
        </div>
        <motion.h1
          className="font-serif text-5xl md:text-7xl lg:text-[8rem] xl:text-[10rem] leading-[0.85] tracking-[0.04em] text-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.0, delay: 3.0, ease: [0.25, 0.1, 0.25, 1] }}
          style={{ opacity: textOpacity }}
        >
          Industrial
          <br />
          Magic
        </motion.h1>
        <motion.p
          className="mt-8 text-[11px] tracking-[0.3em] uppercase text-muted-foreground border-l border-foreground/10 pl-4 md:pl-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 5.8, ease: "easeOut" }}
        >
          VFX, CGI, and 3D at the intersection of technical precision
          and artistic vision.{" "}
          <span
            className="font-bold"
            style={{
              background: "linear-gradient(90deg, #5ab9ff 0%, #9b5c8c 30%, #e67d00 68%, #fff8be 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            We make the extraordinary, for everyone.
          </span>
        </motion.p>
      </div>
    </section>
  );
};

export default HeroSection;
