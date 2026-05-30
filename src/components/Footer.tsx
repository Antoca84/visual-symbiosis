const Footer = () => (
  <footer className="w-full px-6 md:px-12 py-5 md:py-8 flex items-center justify-between border-t border-white/5">
    <span className="text-[8px] md:text-[11px] tracking-[0.08em] md:tracking-[0.2em] uppercase text-muted-foreground">
      © {new Date().getFullYear()} Industrial Magic
    </span>
    <a
      href="mailto:hello@industrialmagic.it"
      className="text-[8px] md:text-[11px] tracking-[0.08em] md:tracking-[0.2em] uppercase text-muted-foreground hover:text-foreground transition-colors duration-300"
    >
      hello@industrialmagic.it
    </a>
  </footer>
);

export default Footer;
