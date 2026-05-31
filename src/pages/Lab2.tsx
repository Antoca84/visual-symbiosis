import { motion } from "framer-motion";
import Navigation from "@/components/Navigation";
import { ClothDemo2 } from "@/components/ClothDemo2";

const Lab2 = () => (
  <main className="bg-[#0b0d14] min-h-screen">
    <Navigation />
    <section className="relative h-svh md:h-screen w-full overflow-hidden flex items-center md:items-end md:pb-24">
      <ClothDemo2 />

      <div className="relative z-10 px-6 md:px-12 w-full pointer-events-none">
        <div className="border-l border-white/40 pl-4 md:pl-6 inline-block mb-3 md:mb-4">
          <span className="text-[9px] tracking-[0.35em] uppercase text-white/55">
            Visual Laboratory · Verlet B
          </span>
        </div>
        <motion.h1
          className="font-serif text-5xl md:text-7xl lg:text-[8rem] xl:text-[10rem] leading-[0.85] tracking-[0.04em] text-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.0, delay: 3.0, ease: [0.25, 0.1, 0.25, 1] }}
        >
          Industrial
          <br />
          Magic
        </motion.h1>
        <motion.p
          className="mt-8 text-[11px] tracking-[0.3em] uppercase text-white/40 border-l border-white/10 pl-4 md:pl-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 6.0, ease: "easeOut" }}
        >
          VFX, CGI, and 3D at the intersection of technical precision
          and artistic vision. We make the extraordinary, for everyone.
        </motion.p>
      </div>
    </section>
  </main>
);

export default Lab2;
