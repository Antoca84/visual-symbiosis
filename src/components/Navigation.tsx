import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const Navigation = () => {
  const [hidden, setHidden] = useState(false);
  const [lastY, setLastY] = useState(0);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setHidden(y > 100 && y > lastY);
      setLastY(y);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [lastY]);

  useEffect(() => {
    setHidden(false);
    setLastY(0);
    window.scrollTo(0, 0);
  }, [location]);

  const links = [
    { to: "/", label: "Work" },
    { to: "/about", label: "About" },
    { to: "/contact", label: "Contact" },
  ];

  return (
    <motion.header
      animate={{ y: hidden ? -100 : 0 }}
      transition={{ duration: 0.35, ease: "easeInOut" }}
      className="fixed top-0 left-0 right-0 z-50 px-6 md:px-12 py-5 flex items-center justify-between"
    >
      <Link
        to="/"
        className="font-serif text-xl md:text-2xl tracking-[0.15em] text-foreground uppercase"
      >
        Industrial Magic
      </Link>
      <nav className="flex items-center gap-6 md:gap-10">
        {links.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className={cn(
              "text-[11px] tracking-[0.25em] uppercase transition-opacity duration-300",
              location.pathname === link.to
                ? "text-foreground opacity-100"
                : "text-muted-foreground opacity-70 hover:opacity-100"
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </motion.header>
  );
};

export default Navigation;
