import { Home, Library, User, CalendarDays, Plus } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";

export type TabId = "home" | "soirees" | "cinema" | "profile";

type TabDef = { id: TabId; label: string; icon: React.ComponentType<any>; path: string };

const tabs: TabDef[] = [
  { id: "home",    label: "Accueil",       icon: Home,        path: "/app" },
  { id: "soirees", label: "Soirées",       icon: CalendarDays, path: "/app/soirees" },
  { id: "cinema",  label: "Bibliothèque",  icon: Library,     path: "/app/my-cinema" },
  { id: "profile", label: "Profil",        icon: User,        path: "/app/profile" },
];

const BottomTabBar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const currentTab =
    tabs.find((t) => location.pathname === t.path)?.id ||
    (location.pathname.startsWith("/app/soiree") ? "soirees" : "home");

  return (
    <nav className="fixed md:absolute bottom-0 left-0 right-0 z-[51] pb-[env(safe-area-inset-bottom)] md:pb-0">
      <div className="pointer-events-none absolute -top-10 inset-x-0 h-10 bg-gradient-to-t from-background via-background/70 to-transparent" />

      <div className="relative border-t border-white/[0.05] bg-[linear-gradient(180deg,hsl(240_18%_5%/0.85),hsl(240_22%_3%/0.96))] backdrop-blur-2xl md:rounded-b-[2.25rem] shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex items-stretch justify-around h-[60px] max-w-lg mx-auto px-2">
          {/* Left 2 tabs */}
          {tabs.slice(0, 2).map((tab) => <TabButton key={tab.id} tab={tab} isActive={currentTab === tab.id} navigate={navigate} location={location} />)}

          {/* FAB center */}
          <div className="relative flex items-center justify-center flex-1">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate("/app/soiree/nouvelle")}
              className="absolute -top-5 w-14 h-14 rounded-full bg-gradient-to-b from-primary to-accent shadow-[0_8px_30px_-6px_hsl(var(--primary)/0.7)] flex items-center justify-center active:scale-95 transition-transform"
              aria-label="Créer une soirée"
            >
              <Plus className="w-6 h-6 text-primary-foreground" strokeWidth={2.2} />
            </motion.button>
          </div>

          {/* Right 2 tabs */}
          {tabs.slice(2).map((tab) => <TabButton key={tab.id} tab={tab} isActive={currentTab === tab.id} navigate={navigate} location={location} />)}
        </div>
      </div>
    </nav>
  );
};

function TabButton({ tab, isActive, navigate, location }: {
  tab: TabDef;
  isActive: boolean;
  navigate: ReturnType<typeof useNavigate>;
  location: ReturnType<typeof useLocation>;
}) {
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
      className="relative flex flex-col items-center justify-center flex-1 pt-1.5 pb-1 transition-colors"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      {isActive && (
        <motion.span
          layoutId="tab-halo"
          className="absolute top-0 w-12 h-9 rounded-full bg-primary/15 blur-xl"
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
        />
      )}
      {isActive && (
        <motion.span
          layoutId="tab-indicator"
          className="absolute top-0 h-[2px] w-8 rounded-full bg-gradient-to-r from-primary to-accent shadow-[0_0_10px_hsl(var(--primary)/0.8)]"
          transition={{ type: "spring", stiffness: 360, damping: 28 }}
        />
      )}
      <motion.div
        animate={{ scale: isActive ? 1.06 : 1, y: isActive ? -1 : 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 24 }}
        className="relative flex items-center justify-center h-[26px]"
      >
        <Icon
          className={`w-[20px] h-[20px] transition-colors duration-200 ${isActive ? "text-primary" : "text-foreground/35"}`}
          strokeWidth={isActive ? 2.2 : 1.7}
        />
      </motion.div>
      <span className={`mt-1 text-[10px] font-sans tracking-tight transition-colors duration-200 ${isActive ? "text-primary font-semibold" : "text-foreground/40 font-medium"}`}>
        {tab.label}
      </span>
    </button>
  );
}

export default BottomTabBar;
