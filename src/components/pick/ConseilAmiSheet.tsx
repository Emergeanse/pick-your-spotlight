import { useEffect, useState } from "react";
import { avatarAffiche } from "@/lib/avatars";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { loadAcceptedFriends, type DuoFriendCandidate } from "@/lib/duo-profiles";
import { conseilStore, envoyerConseil, MESSAGE_CONSEIL_MAX, useFilmAConseiller } from "@/lib/conseils";
import { getPosterUrl } from "@/lib/tmdb";

/**
 * « Conseiller à un ami » : panneau qui monte du bas, ouvert depuis n'importe
 * quelle fiche film (MovieActionBar) via `conseilStore.ouvrir`. Monté une seule
 * fois, dans AppLayout. On coche un ou plusieurs amis, un petit mot facultatif,
 * et c'est parti : le serveur prévient chacun.
 */
const ConseilAmiSheet = () => {
  const film = useFilmAConseiller();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [amis, setAmis] = useState<DuoFriendCandidate[] | null>(null);
  const [choisis, setChoisis] = useState<Set<string>>(new Set());
  const [mot, setMot] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const { pathname } = useLocation();

  // Changer de page referme le panneau.
  useEffect(() => { conseilStore.fermer(); }, [pathname]);

  useEffect(() => {
    if (!film || !user) return;
    setChoisis(new Set());
    setMot("");
    setAmis(null);
    loadAcceptedFriends(user.id).then(setAmis).catch(() => setAmis([]));
  }, [film, user]);

  const fermer = () => conseilStore.fermer();

  const basculer = (id: string) =>
    setChoisis((prev) => {
      const suivant = new Set(prev);
      if (suivant.has(id)) suivant.delete(id); else suivant.add(id);
      return suivant;
    });

  const envoyer = async () => {
    if (!film || !user || choisis.size === 0) return;
    setEnvoi(true);
    try {
      const n = await envoyerConseil(user.id, film, [...choisis], mot);
      toast.success(n > 1 ? `Conseil envoyé à ${n} amis` : "Conseil envoyé !");
      fermer();
    } catch {
      toast.error("Impossible d'envoyer le conseil pour le moment.");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <AnimatePresence>
      {film && (
        <>
          <motion.div
            key="fond"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed md:absolute inset-0 z-[60] bg-black/50"
            onClick={fermer}
          />
          <motion.div
            key="panneau"
            role="dialog"
            aria-modal="true"
            aria-label={`Conseiller ${film.titre} à un ami`}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.26, ease: [0.2, 0.8, 0.2, 1] }}
            className="fixed md:absolute inset-x-0 bottom-0 z-[61] max-h-[85vh] md:max-h-[85%] flex flex-col rounded-t-pick-xl bg-pick-surface border-t border-pick-border shadow-pick-card pb-[env(safe-area-inset-bottom)]"
          >
            <div className="flex items-center gap-3 p-4 border-b border-pick-border">
              {film.posterPath ? (
                <img src={getPosterUrl(film.posterPath, "w92")} alt="" className="w-10 h-[60px] rounded-pick-sm object-cover shrink-0" />
              ) : (
                <div className="w-10 h-[60px] rounded-pick-sm bg-foreground/5 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-sans font-semibold uppercase tracking-[0.12em] text-pick-purple-light">Conseiller à un ami</p>
                <p className="text-[16px] font-sans font-bold text-foreground leading-tight truncate">{film.titre}</p>
              </div>
              <button type="button" onClick={fermer} aria-label="Fermer" className="p-1 rounded-full text-pick-text-muted shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {amis === null ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => <div key={i} className="h-12 rounded-pick-md bg-primary/[0.06] animate-pulse" />)}
                </div>
              ) : amis.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-[14px] font-sans text-foreground">Tu n&apos;as pas encore d&apos;amis sur Pick.</p>
                  <p className="text-[12px] font-sans text-pick-text-secondary mt-1">Ajoute-en pour leur conseiller des films.</p>
                  <button
                    type="button"
                    onClick={() => { fermer(); navigate("/app/friends"); }}
                    className="mt-4 px-4 py-2 rounded-full bg-primary text-primary-foreground text-[14px] font-sans font-semibold"
                  >
                    Ajouter des amis
                  </button>
                </div>
              ) : (
                <>
                  <ul className="space-y-1.5" role="list">
                    {amis.map((ami) => {
                      const coche = choisis.has(ami.id);
                      return (
                        <li key={ami.id}>
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={coche}
                            onClick={() => basculer(ami.id)}
                            className={`w-full flex items-center gap-3 p-2.5 rounded-pick-md border text-left transition-colors duration-180 ease-pick ${
                              coche ? "border-pick-border-active bg-primary/15" : "border-pick-border bg-transparent"
                            }`}
                          >
                            <span className="w-9 h-9 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center shrink-0">
                              {avatarAffiche(ami.avatarUrl)
                                ? <img src={avatarAffiche(ami.avatarUrl)} alt="" className="w-full h-full object-cover" />
                                : <span className="text-[13px] font-bold text-primary">{ami.displayName.charAt(0).toUpperCase()}</span>}
                            </span>
                            <span className="flex-1 min-w-0 text-[14px] font-sans font-medium text-foreground truncate">{ami.displayName}</span>
                            <span className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 ${coche ? "bg-primary border-primary" : "border-pick-border-hover"}`}>
                              {coche && <Check className="w-3.5 h-3.5 text-primary-foreground" strokeWidth={3} />}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>

                  <label className="block mt-4">
                    <span className="text-[12px] font-sans font-medium text-pick-text-secondary">Un petit mot (facultatif)</span>
                    <textarea
                      value={mot}
                      onChange={(e) => setMot(e.target.value.slice(0, MESSAGE_CONSEIL_MAX))}
                      rows={2}
                      placeholder="Tu vas adorer la fin !"
                      className="mt-1.5 w-full resize-none rounded-pick-md border border-pick-border bg-background/60 px-3 py-2 text-[14px] font-sans text-foreground placeholder:text-pick-text-muted focus:outline-none focus:border-pick-border-active"
                    />
                    <span className="block text-right text-[11px] font-sans text-pick-text-muted">{mot.length}/{MESSAGE_CONSEIL_MAX}</span>
                  </label>
                </>
              )}
            </div>

            {amis && amis.length > 0 && (
              <div className="p-4 pt-0">
                <button
                  type="button"
                  onClick={envoyer}
                  disabled={choisis.size === 0 || envoi}
                  className="w-full py-3 rounded-full bg-primary text-primary-foreground text-[15px] font-sans font-semibold shadow-pick-active disabled:opacity-35 disabled:shadow-none transition-opacity duration-180 ease-pick"
                >
                  {choisis.size === 0
                    ? "Choisis au moins un ami"
                    : choisis.size === 1 ? "Envoyer le conseil" : `Envoyer à ${choisis.size} amis`}
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ConseilAmiSheet;
