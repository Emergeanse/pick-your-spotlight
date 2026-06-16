import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";

import AppLayout from "@/components/pick/AppLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import Landing from "./pages/Landing.tsx";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import Onboarding from "./pages/Onboarding.tsx";
import Profile from "./pages/Profile.tsx";
import CinemaDNAPage from "./pages/CinemaDNAPage.tsx";
import MyCinema from "./pages/MyCinema.tsx";
import Glossary from "./pages/Glossary.tsx";
import PickPlusPage from "./pages/PickPlus.tsx";
import NotFound from "./pages/NotFound.tsx";
import WatchlistPageRoute from "./pages/WatchlistRoute.tsx";
import Friends from "./pages/Friends.tsx";
import PickTogether from "./pages/PickTogether.tsx";
import JoinSession from "./pages/JoinSession.tsx";
import JoinDuo from "./pages/JoinDuo.tsx";
import DuoPage from "./pages/DuoPage.tsx";
import SoireesPage from "./pages/SoireesPage.tsx";
import Admin from "./pages/Admin.tsx";
import PlanSession from "./pages/PlanSession.tsx";
import History from "./pages/History.tsx";
import InvitePage from "./pages/InvitePage.tsx";
import CreateEventPage from "./pages/CreateEventPage.tsx";
import EventDetailPage from "./pages/EventDetailPage.tsx";

const queryClient = new QueryClient();

function HomePage() {
  const { user, isReady } = useAuth();
  if (!isReady) return null;
  return user ? <Navigate to="/app" replace /> : <Landing />;
}

function AppRoute() {
  const { user, isReady } = useAuth();
  if (!isReady) return null;
  if (!user) return <Navigate to="/auth" replace />;
  return <Index />;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isReady } = useAuth();
  if (!isReady) return null;
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
            <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            <Route path="/glossary" element={<ProtectedRoute><AppLayout><Glossary /></AppLayout></ProtectedRoute>} />
            <Route path="/profile" element={<Navigate to="/app/profile" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </ErrorBoundary>
        </BrowserRouter>
      </>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
