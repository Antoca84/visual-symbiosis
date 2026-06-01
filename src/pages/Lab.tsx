import { ClothDemo } from "@/components/ClothDemo";

const Lab = () => (
  <main className="bg-[#0b0d14] w-screen h-screen overflow-hidden">
    <div className="absolute top-4 left-6 z-10 font-mono text-[10px] tracking-[0.3em] uppercase text-white/20">
      Lab / Cloth Verlet A
    </div>
    <div className="absolute top-4 right-6 z-10 font-mono text-[10px] tracking-[0.2em] text-white/15">
      drag to tear · hover to perturb
    </div>
    <ClothDemo showControls={true} />
  </main>
);

export default Lab;
