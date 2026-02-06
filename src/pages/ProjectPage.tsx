import { useParams, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import Navigation from "@/components/Navigation";
import ScrollReveal from "@/components/ScrollReveal";
import { projects } from "@/data/projects";

const imageLayouts = [
  "w-full",
  "px-6 md:px-12 md:w-[75%]",
  "px-6 md:px-12 md:w-[80%] md:ml-auto",
];

const ProjectPage = () => {
  const { slug } = useParams();
  const project = projects.find((p) => p.slug === slug);

  if (!project) return <Navigate to="/" replace />;

  return (
    <main className="bg-background min-h-screen">
      <Navigation />

      {/* Title */}
      <section className="pt-32 md:pt-44 pb-16 md:pb-24 px-6 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <p className="text-[11px] tracking-[0.3em] uppercase text-muted-foreground mb-6">
            {project.subtitle}
          </p>
          <h1 className="font-serif text-4xl md:text-6xl lg:text-8xl text-foreground italic leading-[0.95]">
            {project.title}
          </h1>
        </motion.div>
      </section>

      {/* Image plates */}
      {project.images.map((image, index) => (
        <ScrollReveal
          key={index}
          className="mb-8 md:mb-16"
        >
          <div className={imageLayouts[index % imageLayouts.length]}>
            <img
              src={image.src}
              alt={image.alt}
              className="w-full object-cover"
              style={{ aspectRatio: image.aspect || "16/9" }}
              loading="lazy"
            />
          </div>
        </ScrollReveal>
      ))}

      {/* Interpretive text */}
      {project.texts.length > 0 && (
        <ScrollReveal className="py-24 md:py-40 px-6 md:px-12">
          <div className="md:ml-[15%] lg:ml-[20%] max-w-xl">
            {project.texts.map((text, index) => (
              <p
                key={index}
                className="font-serif text-xl md:text-2xl text-foreground/60 italic leading-[1.5] mb-8 last:mb-0"
              >
                {text}
              </p>
            ))}
          </div>
        </ScrollReveal>
      )}

      <div className="h-24 md:h-40" />
    </main>
  );
};

export default ProjectPage;
