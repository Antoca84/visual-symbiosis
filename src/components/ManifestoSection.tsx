import ScrollReveal from "./ScrollReveal";

const ManifestoSection = () => {
  return (
    <section className="py-16 md:py-24 px-6 md:px-12">
      <div className="max-w-screen-xl mx-auto">
        <ScrollReveal>
          <div className="md:ml-[20%] lg:ml-[25%] max-w-2xl">
            <p className="font-serif text-2xl md:text-3xl lg:text-[2.5rem] leading-[1.4] text-foreground/70 italic">
              We do not render defaults.
              <br />
              We do not generate shortcuts.
              <br />
              We do not settle for good enough.
            </p>
          </div>
        </ScrollReveal>
        <ScrollReveal delay={0.2}>
          <div className="md:ml-[20%] lg:ml-[25%] max-w-2xl mt-10 md:mt-14">
            <p className="font-serif text-2xl md:text-3xl lg:text-[2.5rem] leading-[1.4] text-foreground/70 italic">
              We build visual worlds —{" "}
              <br className="hidden md:block" />
              in VFX, CGI, three dimensions —{" "}
              <br className="hidden md:block" />
              where craft is not a luxury.{" "}
              <br className="hidden md:block" />
              It is the standard.
            </p>
          </div>
        </ScrollReveal>
        <ScrollReveal delay={0.4}>
          <div className="md:ml-[20%] lg:ml-[25%] max-w-2xl mt-10 md:mt-14">
            <p className="font-serif text-xl md:text-2xl lg:text-[1.75rem] leading-[1.5] text-foreground/40 italic">
              Between cinema and science, between light and structure —
              we operate. Not to document. Not to simulate.
              To author.
            </p>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};

export default ManifestoSection;
