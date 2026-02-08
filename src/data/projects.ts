import coverDivision from "@/assets/project-division.jpg";
import coverAnatomies from "@/assets/project-anatomies.jpg";
import coverSignal from "@/assets/project-signal.jpg";
import coverDeepTime from "@/assets/project-deep-time.jpg";

export interface ProjectImage {
  src: string;
  alt: string;
  aspect?: string;
}

export interface Project {
  slug: string;
  title: string;
  subtitle: string;
  coverImage: string;
  coverAspect?: string;
  images: ProjectImage[];
  texts: string[];
}

export const projects: Project[] = [
  {
    slug: "the-architecture-of-division",
    title: "The Architecture of Division",
    subtitle: "Cell mitosis as structural drama",
    coverImage: coverDivision,
    coverAspect: "3/4",
    images: [
      {
        src: coverDivision,
        alt: "Cell division interpreted as architectural form",
        aspect: "3/4",
      },
    ],
    texts: [
      "What if division were not a biological event, but an architectural one — a structure tearing itself into symmetry.",
      "Each plate captures the moment where one becomes two, rendered not as process but as formal consequence.",
    ],
  },
  {
    slug: "invisible-anatomies",
    title: "Invisible Anatomies",
    subtitle: "Molecular structures as graphic-novel panels",
    coverImage: coverAnatomies,
    coverAspect: "1/1",
    images: [
      {
        src: coverAnatomies,
        alt: "Molecular forms rendered as graphic narrative",
        aspect: "1/1",
      },
    ],
    texts: [
      "Molecules do not narrate themselves. We give them a voice — drawn in shadow, structured in panels, read like fiction.",
      "The invisible made legible. Anatomy as story.",
    ],
  },
  {
    slug: "signal-and-noise",
    title: "Signal and Noise",
    subtitle: "Neural pathways as abstract topographies",
    coverImage: coverSignal,
    coverAspect: "16/9",
    images: [
      {
        src: coverSignal,
        alt: "Neural pathways visualized as topographic landscape",
        aspect: "16/9",
      },
    ],
    texts: [
      "Between every thought, there is terrain. These images map the landscape of transmission — not the message, but the medium.",
      "Where signal dissolves into noise, meaning begins.",
    ],
  },
  {
    slug: "deep-time",
    title: "Deep Time",
    subtitle: "Evolutionary processes as slow visual narratives",
    coverImage: coverDeepTime,
    coverAspect: "1/1",
    images: [
      {
        src: coverDeepTime,
        alt: "Deep evolutionary time rendered as visual narrative",
        aspect: "1/1",
      },
    ],
    texts: [
      "Time is not a line. It is a pressure — geological, biological, irreversible. These images carry its weight.",
      "Slow enough to fossilize. Fast enough to forget.",
    ],
  },
];
