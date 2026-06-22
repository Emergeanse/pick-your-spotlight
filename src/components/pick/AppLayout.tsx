import { useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import BottomTabBar from "@/components/pick/BottomTabBar";
import BrandHeader from "@/components/pick/BrandHeader";
import OnboardingResumeBanner from "@/components/onboarding/OnboardingResumeBanner";
import { useOnboardingGate } from "@/hooks/use-onboarding-gate";

/**
 * Mobile-first layout. On md+ we frame the app as a centered phone-shaped
 * surface so the mobile UI no longer stretches across desktop viewports.
 * BottomTabBar stays `fixed` but is constrained to the frame via CSS on md+.
 */
const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const { checking } = useOnboardingGate();
  // Ces pages gèrent leur propre header — pas besoin du BrandHeader global
  const PAGES_WITH_OWN_HEADER = ["/app", "/app/profile", "/app/adn"];
  const PREFIXES_WITH_OWN_HEADER = ["/app/soiree", "/app/soirees"];
  const showHeader = !PAGES_WITH_OWN_HEADER.includes(location.pathname)
    && !PREFIXES_WITH_OWN_HEADER.some(p => location.pathname.startsWith(p));

  if (checking) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-primary/50" />
      </div>
    );
  }

  return (
    <div className="md:fixed md:inset-0 md:flex md:items-center md:justify-center md:bg-background">
      <div className="md:relative md:transform-gpu md:w-[420px] md:h-[min(900px,calc(100dvh-2rem))] md:rounded-[2.25rem] md:overflow-hidden md:border md:border-border/20 md:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] md:bg-background">
        {showHeader && (
          <div className="sticky top-0 z-30">
            <BrandHeader />
          </div>
        )}
        <OnboardingResumeBanner />
        {children}
        <BottomTabBar />
      </div>
    </div>
  );
};

export default AppLayout;
