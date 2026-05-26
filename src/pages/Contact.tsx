import { motion } from "framer-motion";
import Navigation from "@/components/Navigation";

const Contact = () => {
  return (
    <main className="bg-background min-h-screen flex flex-col">
      <Navigation />

      <section className="flex-1 flex items-center px-6 md:px-12">
        <div className="max-w-screen-xl mx-auto w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <p className="text-[11px] tracking-[0.3em] uppercase text-muted-foreground mb-8">
              Contact
            </p>
            <a
              href="mailto:hello@industrialmagic.it"
              className="font-serif text-3xl md:text-5xl lg:text-6xl text-foreground/80 italic hover:text-foreground transition-colors duration-500 inline-block"
            >
              hello@industrialmagic.it
            </a>
            <p className="font-serif text-base md:text-lg text-foreground/30 italic mt-16">
              Collaborations emerge through dialogue, not applications.
            </p>
          </motion.div>
        </div>
      </section>
    </main>
  );
};

export default Contact;
