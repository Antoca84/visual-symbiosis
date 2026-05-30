import Navigation from "@/components/Navigation";
import HeroSection from "@/components/HeroSection";
import ManifestoSection from "@/components/ManifestoSection";
import VisualBreak from "@/components/VisualBreak";
import DisciplinesSection from "@/components/DisciplinesSection";
import ClosingLine from "@/components/ClosingLine";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <main className="bg-background min-h-screen">
      <Navigation />
      <HeroSection />
      <ManifestoSection />
      <VisualBreak />
      <DisciplinesSection />
      <ClosingLine />
      <Footer />
    </main>
  );
};

export default Index;
