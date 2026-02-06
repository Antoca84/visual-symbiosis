import ScrollReveal from "./ScrollReveal";

const ManifestoSection = () => {
  return (
    <section className="py-32 md:py-48 px-6 md:px-12">
      <div className="max-w-screen-xl mx-auto">
        <ScrollReveal>
          <div className="md:ml-[20%] lg:ml-[25%] max-w-2xl">
            <p className="font-serif text-2xl md:text-3xl lg:text-[2.5rem] leading-[1.4] text-foreground/70 italic">
              We do not create diagrams.
              <br />
              We do not simulate.
              <br />
              We do not illustrate procedures.
            </p>
          </div>
        </ScrollReveal>
        <ScrollReveal delay={0.2}>
          <div className="md:ml-[20%] lg:ml-[25%] max-w-2xl mt-10 md:mt-14">
            <p className="font-serif text-2xl md:text-3xl lg:text-[2.5rem] leading-[1.4] text-foreground/70 italic">
              We interpret scientific phenomena —{" "}
              <br className="hidden md:block" />
              where biology becomes narrative{" "}
              <br className="hidden md:block" />
              and structure becomes drama.
            </p>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};

export default ManifestoSection;
