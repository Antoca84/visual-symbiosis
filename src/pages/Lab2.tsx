import { ClothDemo2 } from "@/components/ClothDemo2";

const Lab2 = () => (
  <main className="bg-[#0b0d14] w-screen h-screen overflow-hidden">
    <div className="absolute top-4 left-6 z-10 font-mono text-[10px] tracking-[0.3em] uppercase text-white/20">
      Lab / Cloth Verlet B
    </div>
    <div className="absolute top-4 right-6 z-10 font-mono text-[10px] tracking-[0.2em] text-white/15">
      drag to tear · letter formation
    </div>
    <ClothDemo2 />
  </main>
);

export default Lab2;
