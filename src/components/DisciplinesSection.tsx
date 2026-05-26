import { useRef } from "react";
import { motion, useInView } from "framer-motion";

const disciplines = [
  {
    number: "01",
    title: "VFX & Visual Effects",
    description:
      "We bend reality with surgical precision. Every frame is authored, not generated. Not simulation — intention.",
  },
  {
    number: "02",
    title: "CGI & 3D",
    description:
      "Structure, light, volume. Every surface a decision. Every shadow earned.",
  },
  {
    number: "03",
    title: "Scientific Visualization",
    description:
      "Phenomena beyond the visible — given form, weight, and dramatic consequence. Science as visual drama.",
  },
  {
    number: "04",
    title: "Cinema & Motion",
    description:
      "Time as medium. Movement as argument. Pacing as meaning.",
  },
];

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.10 } },
};

const item = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.25, 0.1, 0.25, 1] } },
};

const DisciplinesSection = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section className="py-16 md:py-24 px-6 md:px-12 border-t border-border">
      <div className="max-w-screen-xl mx-auto">
        <motion.p
          className="text-[11px] tracking-[0.3em] uppercase text-muted-foreground mb-10 md:mb-14"
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6 }}
        >
          Disciplines
        </motion.p>

        <motion.div
          ref={ref}
          className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border border-t border-border"
          variants={container}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
        >
          {disciplines.map((d) => (
            <motion.div
              key={d.number}
              variants={item}
              className="flex flex-col gap-3 pt-6 pb-2 px-4 first:pl-0 last:pr-0"
            >
              <span className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground/40">
                {d.number}
              </span>
              <h3 className="font-serif text-lg md:text-xl lg:text-2xl text-foreground/80 italic leading-[1.2]">
                {d.title}
              </h3>
              <p className="text-[11px] tracking-[0.03em] text-muted-foreground leading-relaxed">
                {d.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default DisciplinesSection;
