import { Home, Bookmark, Clapperboard, User, Users } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";

export type TabId = "home" | "watchlist" | "together" | "cinema" | "profile";

const tabs: { id: TabId; label: string; icon: typeof Home; path: string }[] = [
  { id: "home", label: "Trouve-moi", icon: Home, path: "/app" },
  { id: "together", label: "Match", icon: Users, path: "/app/pick-together" },
  { id: "watchlist", label: "Bibliothèque", icon: Bookmark, path: "/app/watchlist" },
  { id: "cinema", label: "Cinéma", icon: Clapperboard, path: "/app/my-cinema" },
  { id: "profile", label: "Profil", icon: User, path: "/app/profile" },
];

const BottomTabBar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const currentTab = tabs.find((t) => location.pathname === t.path)?.id || "home";

  return (
    <nav className="fixed md:absolute bottom-0 left-0 right-0 z-40 pb-[env(safe-area-inset-bottom)] md:pb-0">
      {/* Top fade so the bar blends with cinematic background */}
      <div className="pointer-events-none absolute -top-8 inset-x-0 h-8 bg-gradient-to-t from-background to-transparent" />

      <div className="relative bg-background/80 backdrop-blur-2xl border-t border-white/[0.06] md:rounded-b-[2.25rem] shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
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
                      window.dispatchEvent(new CustomEvent("home-reset"));
                    } else {
                      navigate("/app");
                    }
                  } else if (tab.id === "cinema") {
                    if (location.pathname === "/app/my-cinema") {
                      window.dispatchEvent(new CustomEvent("cinema-reset"));
                    } else {
                      navigate(tab.path);
                    }
                  } else {
                    navigate(tab.path);
                  }
                }}
                className="relative flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                {isActive && (
                  <motion.span
                    layoutId="tab-glow"
                    className="absolute top-1 w-10 h-10 rounded-full bg-primary/15 blur-md"
                    transition={{ type: "spring", stiffness: 320, damping: 28 }}
                  />
                )}

                <motion.div
                  animate={{ y: isActive ? -1 : 0, scale: isActive ? 1.05 : 1 }}
                  transition={{ type: "spring", stiffness: 360, damping: 24 }}
                  className="relative"
                >
                  <Icon
                    className={`w-[20px] h-[20px] transition-colors duration-200 ${
                      isActive ? "text-primary" : "text-foreground/40"
                    }`}
                    strokeWidth={isActive ? 2.2 : 1.8}
                  />
                </motion.div>

                <span
                  className={`text-[10.5px] font-sans transition-colors duration-200 ${
                    isActive ? "text-primary font-semibold" : "text-foreground/40 font-medium"
                  }`}
                >
                  {tab.label}
                </span>

                {isActive && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute -bottom-0.5 h-[3px] w-7 rounded-full bg-gradient-to-r from-primary to-accent shadow-[0_0_12px_hsl(var(--primary)/0.7)]"
                    transition={{ type: "spring", stiffness: 320, damping: 26 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomTabBar;
