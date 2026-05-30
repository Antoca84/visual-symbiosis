import { useState } from "react";
import { motion } from "framer-motion";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

const EMAIL = "hello@industrialmagic.it";

const Contact = () => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const confirm = () => { setCopied(true); setTimeout(() => setCopied(false), 1200); };

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(EMAIL).then(confirm).catch(fallback);
    } else {
      fallback();
    }
  };

  const fallback = () => {
    const el = document.createElement("input");
    el.value = EMAIL;
    el.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(el);
    el.focus(); el.select();
    try { document.execCommand("copy"); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch {}
    document.body.removeChild(el);
  };

  return (
    <main className="bg-background min-h-screen flex flex-col">
      <Navigation />

      <section className="flex-1 flex items-center px-6 md:px-12">
        <div className="w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <p className="text-[11px] tracking-[0.3em] uppercase text-muted-foreground mb-8">
              Contact
            </p>
            <a
              href={`mailto:${EMAIL}`}
              className="font-serif text-3xl md:text-5xl lg:text-6xl text-foreground/80 italic hover:text-foreground transition-colors duration-500 inline-block"
            >
              {EMAIL}
            </a>

            <motion.button
              onClick={handleCopy}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mt-8 flex items-center gap-3 text-[11px] tracking-[0.3em] uppercase text-muted-foreground hover:text-foreground transition-colors duration-300 group"
            >
              <span className="w-4 h-px bg-current transition-all duration-300 group-hover:w-6" />
              {copied ? "Copied" : "Copy e-mail"}
            </motion.button>

            <p className="font-serif text-base md:text-lg text-foreground/30 italic mt-16">
              Collaborations emerge through dialogue, not applications.
            </p>
          </motion.div>
        </div>
      </section>
      <Footer />
    </main>
  );
};

export default Contact;
