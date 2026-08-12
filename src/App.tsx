import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";

import AppLayout from "@/components/pick/AppLayout";
import ErrorBoundary from "@/components/ErrorBoundary";

// Les pages sont chargées à la demande : chaque route devient un chunk séparé.
// Sans ça, ouvrir l'accueil télécharge aussi Admin, Profile, les graphiques
// Recharts et toutes les autres pages — soit un bundle initial de 2,3 Mo.
const Landing = lazy(() => import("./pages/Landing.tsx"));
const Index = lazy(() => import("./pages/Index.tsx"));
const Auth = lazy(() => import("./pages/Auth.tsx"));
const Onboarding = lazy(() => import("./pages/Onboarding.tsx"));
const Profile = lazy(() => import("./pages/Profile.tsx"));
const CinemaDNAPage = lazy(() => import("./pages/CinemaDNAPage.tsx"));
const MyCinema = lazy(() => import("./pages/MyCinema.tsx"));
const Glossary = lazy(() => import("./pages/Glossary.tsx"));
const PickPlusPage = lazy(() => import("./pages/PickPlus.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const WatchlistPageRoute = lazy(() => import("./pages/WatchlistRoute.tsx"));
const Friends = lazy(() => import("./pages/Friends.tsx"));
const PickTogether = lazy(() => import("./pages/PickTogether.tsx"));
const JoinSession = lazy(() => import("./pages/JoinSession.tsx"));
const JoinDuo = lazy(() => import("./pages/JoinDuo.tsx"));
const DuoPage = lazy(() => import("./pages/DuoPage.tsx"));
const SoireesPage = lazy(() => import("./pages/SoireesPage.tsx"));
const Admin = lazy(() => import("./pages/Admin.tsx"));
const PlanSession = lazy(() => import("./pages/PlanSession.tsx"));
const History = lazy(() => import("./pages/History.tsx"));
const InvitePage = lazy(() => import("./pages/InvitePage.tsx"));
const CreateEventPage = lazy(() => import("./pages/CreateEventPage.tsx"));
const EventDetailPage = lazy(() => import("./pages/EventDetailPage.tsx"));
const MatchPage = lazy(() => import("./pages/MatchPage.tsx"));
const TrustPage = lazy(() => import("./pages/Trust.tsx"));
const PrivacyPage = lazy(() => import("./pages/Privacy.tsx"));
const TermsPage = lazy(() => import("./pages/Terms.tsx"));

const queryClient = new QueryClient();

function AuthLoadingScreen() {
  return (
    <div className="min-h-dvh bg-background text-foreground flex items-center justify-center px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="h-10 w-10 rounded-full border border-primary/30 border-t-primary animate-spin" aria-hidden="true" />
        <p className="text-sm text-foreground/60 font-sans">Pick se prépare…</p>
      </div>
    </div>
  );
}

function HomePage() {
  const { user, isReady } = useAuth();
  if (isReady && user) return <Navigate to="/app" replace />;
  return <Landing />;
}

function AppRoute() {
  const { user, isReady } = useAuth();
  if (!isReady) return null;
  if (!user) return <Navigate to="/auth" replace />;
  return <Index />;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isReady } = useAuth();
  if (!isReady) return <AuthLoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ErrorBoundary>
          <Suspense fallback={<AuthLoadingScreen />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/app" element={<ProtectedRoute><AppLayout><Index /></AppLayout></ProtectedRoute>} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
            <Route path="/app/profile" element={<ProtectedRoute><AppLayout><Profile /></AppLayout></ProtectedRoute>} />
            <Route path="/app/adn" element={<ProtectedRoute><AppLayout><CinemaDNAPage /></AppLayout></ProtectedRoute>} />
            <Route path="/app/my-cinema" element={<ProtectedRoute><AppLayout><MyCinema /></AppLayout></ProtectedRoute>} />
            <Route path="/app/watchlist" element={<ProtectedRoute><AppLayout><WatchlistPageRoute /></AppLayout></ProtectedRoute>} />
            <Route path="/app/friends" element={<ProtectedRoute><AppLayout><Friends /></AppLayout></ProtectedRoute>} />
            <Route path="/app/pick-together" element={<Navigate to="/app" replace />} />
            <Route path="/app/pick-together-group" element={<ProtectedRoute><AppLayout><PickTogether /></AppLayout></ProtectedRoute>} />
            <Route path="/app/pick-plus" element={<ProtectedRoute><AppLayout><PickPlusPage /></AppLayout></ProtectedRoute>} />
            <Route path="/app/plan" element={<ProtectedRoute><AppLayout><PlanSession /></AppLayout></ProtectedRoute>} />
            <Route path="/app/history" element={<ProtectedRoute><AppLayout><History /></AppLayout></ProtectedRoute>} />
            <Route path="/join" element={<JoinSession />} />
            <Route path="/join-duo/:code" element={<JoinDuo />} />
            <Route path="/invite/:token" element={<InvitePage />} />
            <Route path="/app/duo" element={<ProtectedRoute><AppLayout><DuoPage /></AppLayout></ProtectedRoute>} />
            <Route path="/app/event" element={<Navigate to="/app/soirees" replace />} />
            <Route path="/app/soirees" element={<ProtectedRoute><AppLayout><SoireesPage /></AppLayout></ProtectedRoute>} />
            <Route path="/app/soiree/nouvelle" element={<ProtectedRoute><AppLayout><CreateEventPage /></AppLayout></ProtectedRoute>} />
            <Route path="/app/soirees/:id" element={<ProtectedRoute><AppLayout><EventDetailPage /></AppLayout></ProtectedRoute>} />
            <Route path="/app/match" element={<ProtectedRoute><AppLayout><MatchPage /></AppLayout></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            <Route path="/glossary" element={<ProtectedRoute><AppLayout><Glossary /></AppLayout></ProtectedRoute>} />
            <Route path="/profile" element={<Navigate to="/app/profile" replace />} />
            <Route path="/trust" element={<TrustPage />} />
            <Route path="/confidentialite" element={<PrivacyPage />} />
            <Route path="/conditions" element={<TermsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
      </>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
