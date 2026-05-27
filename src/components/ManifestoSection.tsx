import ScrollReveal from "./ScrollReveal";

const ManifestoSection = () => {
  return (
    <section className="py-16 md:py-24 px-6 md:px-12">
      <div>
        <ScrollReveal>
          <div className="md:ml-[20%] lg:ml-[25%] max-w-2xl">
            <p className="font-serif text-2xl md:text-3xl lg:text-[2.5rem] leading-[1.4] text-foreground/70 italic">
              We do not render defaults.
              <br />
              We do not generate shortcuts.
              <br />
              Every frame is a decision.
            </p>
          </div>
        </ScrollReveal>
        <ScrollReveal delay={0.2}>
          <div className="md:ml-[20%] lg:ml-[25%] max-w-2xl mt-10 md:mt-14">
            <p className="font-serif text-2xl md:text-3xl lg:text-[2.5rem] leading-[1.4] text-foreground/70 italic">
              We build visual worlds — in VFX, CGI, and three dimensions —{" "}
              <br className="hidden md:block" />
              for cinema, science, and anything{" "}
              <br className="hidden md:block" />
              that needs to exist before it exists.
            </p>
          </div>
        </ScrollReveal>
        <ScrollReveal delay={0.4}>
          <div className="md:ml-[20%] lg:ml-[25%] max-w-2xl mt-10 md:mt-14">
            <p className="font-serif text-xl md:text-2xl lg:text-[1.75rem] leading-[1.5] text-foreground/40 italic">
              Directors who need a shot that doesn't exist yet.
              Researchers whose data needs to become something people can actually see.
              Brands that refuse to look like everyone else.
              That is who we work with.
            </p>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};

export default ManifestoSection;
