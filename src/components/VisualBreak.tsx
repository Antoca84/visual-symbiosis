import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import leftImage  from "@/assets/visual-break-left.png";
import rightImage from "@/assets/visual-break-right.png";
import { ParticleImageOverlay } from "@/components/ParticleImageOverlay";
import { TriangularWaveOverlay } from "@/components/TriangularWaveOverlay";

const VisualBreak = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-15%" });

  const itemVariants = {
    hidden: { opacity: 0, scale: 1.03 },
    visible: (i: number) => ({
      opacity: 1,
      scale: 1,
      transition: {
        duration: 1.4,
        delay: i * 0.22,
        ease: [0.16, 1, 0.3, 1],
      },
    }),
  };

  return (
    <section
      ref={ref}
      className="w-full py-8 md:py-12"
      aria-hidden="true"
    >
      <div className="grid grid-cols-2 gap-1">
        {[leftImage, rightImage].map((src, i) => (
          <motion.figure
            key={i}
            custom={i}
            variants={itemVariants}
            initial="hidden"
            animate={inView ? "visible" : "hidden"}
            className="overflow-hidden aspect-square relative"
          >
            <img
              src={src}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
            {i === 0 && <ParticleImageOverlay imageSrc={src} />}
            {i === 1 && <TriangularWaveOverlay imageSrc={src} />}
          </motion.figure>
        ))}
      </div>
    </section>
  );
};

export default VisualBreak;
