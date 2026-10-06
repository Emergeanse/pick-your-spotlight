import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import creerSoiree from "@/assets/creer-soiree.webp";
import creerSoireeActif from "@/assets/creer-soiree-actif.webp";
import IconeCharte from "./IconeCharte";
import accueilRepos from "@/assets/icones/accueil-repos.webp";
import accueilActif from "@/assets/icones/accueil-actif.webp";
import soireesRepos from "@/assets/icones/soirees-repos.webp";
import soireesActif from "@/assets/icones/soirees-actif.webp";
import biblioRepos from "@/assets/icones/biblio-repos.webp";
import biblioActif from "@/assets/icones/biblio-actif.webp";
import profilRepos from "@/assets/icones/profil-repos.webp";
import profilActif from "@/assets/icones/profil-actif.webp";

export type TabId = "home" | "soirees" | "cinema" | "profile";

// Illustrations de la charte Pick : `icon` au repos, `activeIcon` quand l'onglet est
// sélectionné ou survolé.
type TabDef = { id: TabId; label: string; icon: string; activeIcon: string; path: string };

const tabs: TabDef[] = [
  { id: "home",    label: "Accueil",       icon: accueilRepos, activeIcon: accueilActif, path: "/app" },
  { id: "soirees", label: "Mes soirées",   icon: soireesRepos, activeIcon: soireesActif, path: "/app/soirees" },
  { id: "cinema",  label: "Biblio",        icon: biblioRepos,  activeIcon: biblioActif,  path: "/app/my-cinema" },
  { id: "profile", label: "Profil",        icon: profilRepos,  activeIcon: profilActif,  path: "/app/profile" },
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

      {/* Liseré violet discret et halo vers le haut : la barre ferme l'univers
          Pick en bas, comme la lueur du haut (AppLayout) l'ouvre. */}
      <div className="relative border-t border-violet-500/25 bg-[linear-gradient(180deg,hsl(240_18%_5%/0.85),hsl(240_22%_3%/0.96))] backdrop-blur-2xl md:rounded-b-[2.25rem] shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.7),0_-6px_22px_-10px_rgba(139,92,246,0.35),inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex items-stretch justify-around h-[60px] max-w-lg mx-auto px-2">
          {/* Left 2 tabs */}
          {tabs.slice(0, 2).map((tab) => <TabButton key={tab.id} tab={tab} isActive={currentTab === tab.id} navigate={navigate} location={location} />)}

          {/* FAB center */}
          <div className="relative flex items-center justify-center flex-1">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                if (location.pathname === "/app") {
                  window.dispatchEvent(new CustomEvent("open-find-choice"));
                } else {
                  navigate("/app?openFindChoice=1");
                }
              }}
              className="group absolute -top-5 w-14 h-14 rounded-full flex items-center justify-center active:scale-[0.96] transition-transform"
              aria-label="Créer une nouvelle soirée ciné"
            >
              {/* Le disque occupe les trois quarts de l'image, le reste est son
                  halo : l'image déborde du bouton pour que le disque, lui,
                  garde les 56 px de l'ancien « + ». Version calme au repos, version
                  lumineuse au survol (souris seulement : sur écran tactile le survol
                  resterait collé après l'appui) et pendant l'appui. */}
              <img
                src={creerSoiree}
                alt=""
                aria-hidden="true"
                draggable={false}
                className="absolute w-[76px] h-[76px] max-w-none pointer-events-none select-none"
              />
              <img
                src={creerSoireeActif}
                alt=""
                aria-hidden="true"
                draggable={false}
                className="absolute w-[76px] h-[76px] max-w-none pointer-events-none select-none opacity-0 group-active:opacity-100 group-focus-visible:opacity-100 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity duration-200"
              />
            </motion.button>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 text-[clamp(8.5px,2.6vw,10px)] font-sans tracking-tight text-violet-200 font-semibold whitespace-nowrap [text-shadow:0_0_8px_rgb(168_85_247/0.9),0_0_16px_rgb(168_85_247/0.5)]"
            >
              Nouvelle soirée
            </span>
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
      className="group relative flex flex-col items-center justify-center flex-1 pt-1.5 pb-1 transition-colors"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      {/* Survol à la souris : un avant-goût de l'onglet actif, halo et violet un
          peu moins intenses pour ne pas le confondre avec l'onglet sélectionné.
          Pas sur écran tactile, où le survol resterait collé après l'appui. */}
      {!isActive && (
        <span
          aria-hidden="true"
          className="absolute top-0 w-12 h-9 rounded-full bg-primary/10 blur-xl opacity-0 transition-opacity duration-200 [@media(hover:hover)]:group-hover:opacity-100"
        />
      )}
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
        <IconeCharte repos={tab.icon} actif={tab.activeIcon} className="w-[26px] h-[26px]" active={isActive} />
      </motion.div>
      <span className={`mt-1 text-[clamp(8.5px,2.6vw,10px)] font-sans tracking-tight transition-colors duration-200 ${isActive ? "text-primary font-semibold" : "text-foreground/40 font-medium [@media(hover:hover)]:group-hover:text-primary/80"}`}>
        {tab.label}
      </span>
    </button>
  );
}

export default BottomTabBar;
