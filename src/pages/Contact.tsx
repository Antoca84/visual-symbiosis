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
              href="mailto:studio@industrialmagic.com"
              className="font-serif text-3xl md:text-5xl lg:text-6xl text-foreground/80 italic hover:text-foreground transition-colors duration-500 inline-block"
            >
              studio@industrialmagic.com
            </a>
            <div className="mt-12">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground hover:text-foreground transition-opacity duration-300"
              >
                Instagram
              </a>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
};

export default Contact;
