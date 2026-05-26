import Navigation from "@/components/Navigation";
import HeroSection from "@/components/HeroSection";
import ManifestoSection from "@/components/ManifestoSection";
import VisualBreak from "@/components/VisualBreak";
import DisciplinesSection from "@/components/DisciplinesSection";
import ClosingLine from "@/components/ClosingLine";

const Index = () => {
  return (
    <main className="bg-background min-h-screen">
      <Navigation />
      <HeroSection />
      <ManifestoSection />
      <VisualBreak />
      <DisciplinesSection />
      <ClosingLine />
    </main>
  );
};

export default Index;
