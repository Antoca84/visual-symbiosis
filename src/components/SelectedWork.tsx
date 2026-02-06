import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import ScrollReveal from "./ScrollReveal";
import { projects } from "@/data/projects";

const layoutVariants = [
  "px-6 md:px-12 md:w-[85%]",
  "px-6 md:px-0 md:w-[65%] md:ml-auto md:mr-12",
  "px-0 w-full",
  "px-6 md:px-12 md:w-[70%] md:mx-auto",
];

const SelectedWork = () => {
  return (
    <section className="pb-24 md:pb-40">
      <ScrollReveal className="px-6 md:px-12 mb-20 md:mb-32">
        <p className="text-[11px] tracking-[0.3em] uppercase text-muted-foreground">
          Selected Work
        </p>
        <p className="font-serif text-base md:text-lg text-foreground/30 italic mt-6 max-w-xl">
          Projects may combine illustration, 3D rendering, and cinematic VFX
          depending on the nature of the scientific question.
        </p>
      </ScrollReveal>

      {projects.map((project, index) => (
        <ScrollReveal key={project.slug} className="mb-20 md:mb-36 last:mb-0">
          <Link
            to={`/project/${project.slug}`}
            className={cn(
              "group block",
              layoutVariants[index % layoutVariants.length]
            )}
          >
            <div className="relative overflow-hidden">
              <img
                src={project.coverImage}
                alt={project.title}
                className="w-full object-cover transition-transform duration-1000 ease-out group-hover:scale-[1.03]"
                style={{ aspectRatio: project.coverAspect || "16/9" }}
                loading="lazy"
              />
              <div className="absolute inset-0 bg-background/0 transition-colors duration-500 group-hover:bg-background/10" />
            </div>
            <div className="mt-6 md:mt-8 px-6 md:px-0">
              <h3 className="font-serif text-2xl md:text-4xl text-foreground italic">
                {project.title}
              </h3>
              <p className="mt-3 text-[11px] tracking-[0.25em] uppercase text-muted-foreground">
                {project.subtitle}
              </p>
            </div>
          </Link>
        </ScrollReveal>
      ))}
    </section>
  );
};

export default SelectedWork;
