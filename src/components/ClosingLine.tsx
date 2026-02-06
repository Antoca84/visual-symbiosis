import ScrollReveal from "./ScrollReveal";

const ClosingLine = () => {
  return (
    <section className="py-32 md:py-48 px-6 md:px-12">
      <ScrollReveal>
        <div className="max-w-screen-xl mx-auto">
          <p className="font-serif text-3xl md:text-5xl lg:text-6xl text-foreground/60 italic leading-[1.3]">
            This is not how science is usually shown.
            <br />
            <span className="text-foreground/30">
              That is exactly the point.
            </span>
          </p>
        </div>
      </ScrollReveal>
    </section>
  );
};

export default ClosingLine;
