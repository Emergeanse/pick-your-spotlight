import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import Landing from "./pages/Landing.tsx";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import Onboarding from "./pages/Onboarding.tsx";
import Profile from "./pages/Profile.tsx";
import MyCinema from "./pages/MyCinema.tsx";
import Glossary from "./pages/Glossary.tsx";
import NotFound from "./pages/NotFound.tsx";
import WatchlistPageRoute from "./pages/WatchlistRoute.tsx";

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
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/app" element={<AppRoute />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
          <Route path="/app/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/app/my-cinema" element={<ProtectedRoute><MyCinema /></ProtectedRoute>} />
          <Route path="/app/watchlist" element={<ProtectedRoute><WatchlistPageRoute /></ProtectedRoute>} />
          <Route path="/glossary" element={<ProtectedRoute><Glossary /></ProtectedRoute>} />
          {/* Legacy redirects */}
          <Route path="/profile" element={<Navigate to="/app/profile" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
