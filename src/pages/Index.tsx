import Navigation from "@/components/Navigation";
import HeroSection from "@/components/HeroSection";
import ManifestoSection from "@/components/ManifestoSection";
import SelectedWork from "@/components/SelectedWork";
import ClosingLine from "@/components/ClosingLine";

const Index = () => {
  return (
    <main className="bg-background min-h-screen">
      <Navigation />
      <HeroSection />
      <ManifestoSection />
      <SelectedWork />
      <ClosingLine />
    </main>
  );
};

export default Index;
