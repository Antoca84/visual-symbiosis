import ScrollReveal from "./ScrollReveal";

const ClosingLine = () => {
  return (
    <section className="py-32 md:py-48 px-6 md:px-12">
      <ScrollReveal>
        <div className="max-w-screen-xl mx-auto">
          <p className="font-serif text-3xl md:text-5xl lg:text-6xl text-foreground/60 italic leading-[1.3]">
            Exceptional quality has always existed.
            <br />
            <span className="text-foreground/30">
              It was never reserved for exceptional budgets.
            </span>
          </p>
        </div>
      </ScrollReveal>
    </section>
  );
};

export default ClosingLine;
