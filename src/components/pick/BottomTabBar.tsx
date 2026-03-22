import { Home, Bookmark, Clapperboard, User, Users } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";

export type TabId = "home" | "watchlist" | "together" | "cinema" | "profile";

const tabs: { id: TabId; label: string; icon: typeof Home; path: string }[] = [
  { id: "home", label: "Accueil", icon: Home, path: "/app" },
  { id: "watchlist", label: "Watchlist", icon: Bookmark, path: "/app/watchlist" },
  { id: "cinema", label: "Mon Cinéma", icon: Clapperboard, path: "/app/my-cinema" },
  { id: "together", label: "Together", icon: Users, path: "/app/pick-together" },
  { id: "profile", label: "Profil", icon: User, path: "/app/profile" },
];

const BottomTabBar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const currentTab = tabs.find(t => location.pathname === t.path)?.id || "home";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-xl border-t border-border/10 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-14 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              data-tour={`tab-${tab.id}`}
              onClick={() => {
                if (tab.id === "home") {
                  if (location.pathname === "/app") {
                    // Force full reset — reload clears all state
                    window.location.href = "/app";
                  } else {
                    navigate("/app");
                  }
                } else {
                  navigate(tab.path);
                }
              }}
              className="relative flex flex-col items-center justify-center gap-0.5 w-16 h-full transition-colors"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-colors duration-200 ${
                    isActive ? "text-primary" : "text-foreground/35"
                  }`}
                />
                {isActive && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  />
                )}
              </div>
              <span
                className={`text-[10px] font-sans font-medium transition-colors duration-200 ${
                  isActive ? "text-primary" : "text-foreground/30"
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomTabBar;
