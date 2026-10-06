import { useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import BottomTabBar from "@/components/pick/BottomTabBar";
import BrandHeader from "@/components/pick/BrandHeader";
import OnboardingResumeBanner from "@/components/onboarding/OnboardingResumeBanner";
import InstallBanner from "@/components/pick/InstallBanner";
import OfflineBanner from "@/components/pick/OfflineBanner";
import { useOnboardingGate } from "@/hooks/use-onboarding-gate";
import { APP_OVERLAY_PORTAL_ID } from "@/lib/app-chrome";

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
      <div className="md:relative md:transform-gpu md:w-[420px] md:h-[min(900px,calc(100dvh-2rem))] md:rounded-[2.25rem] md:overflow-hidden md:border md:border-violet-500/30 md:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6),0_0_5px_rgba(139,92,246,0.08)] md:bg-background">
        {showHeader && (
          <div className="sticky top-0 z-30">
            <BrandHeader />
          </div>
        )}
        <OnboardingResumeBanner />
        {children}
        {/* Fullscreen overlays (z-50) — tab bar stays visible above at z-51 */}
        <div
          id={APP_OVERLAY_PORTAL_ID}
          className="fixed inset-0 md:absolute md:inset-0 z-[50] pointer-events-none [&>*]:pointer-events-auto"
        />
        {/* Lueur d'ambiance en haut de l'écran, presque subliminale : avec le liseré
            de la barre d'onglets, elle enveloppe l'application sans dessiner de
            bordure. Rien sur les côtés, collés au bord physique du téléphone. */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed md:absolute inset-x-0 top-0 h-28 z-[45] bg-[radial-gradient(ellipse_70%_100%_at_50%_0%,rgba(139,92,246,0.13),transparent_70%)]"
        />
        <BottomTabBar />
        <InstallBanner />
        <OfflineBanner />
      </div>
    </div>
  );
};

export default AppLayout;
