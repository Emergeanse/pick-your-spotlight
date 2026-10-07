import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RotateCw, Share2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import AppOverlayPortal from "./AppOverlayPortal";
import CroixRonde from "./CroixRonde";
import {
  dessinerRecto, dessinerVerso, HAUTEUR_CARTE, LARGEUR_CARTE, LIBELLES_RARETE,
  type DonneesCarte, type Finition, type Rarete,
} from "@/lib/carte-pick";

/**
 * La Carte Pick plein écran : recto et verso, retournés d'un toucher, et
 * partagés en image. La finition nacre est réservée à Pick+.
 */
interface CartePickProps {
  ouvert: boolean;
  onFermer: () => void;
  donnees: DonneesCarte;
  rarete: Rarete;
  pickPlus: boolean;
}

const CartePick = ({ ouvert, onFermer, donnees, rarete, pickPlus }: CartePickProps) => {
  const recto = useRef<HTMLCanvasElement>(null);
  const verso = useRef<HTMLCanvasElement>(null);
  const [retournee, setRetournee] = useState(false);
  const [holo, setHolo] = useState(false);
  const [pret, setPret] = useState(false);
  const finition: Finition = holo && pickPlus ? "nacre" : rarete;

  useEffect(() => {
    if (!ouvert || !recto.current || !verso.current) return;
    let actif = true;
    setPret(false);
    Promise.all([dessinerRecto(recto.current, donnees, finition), dessinerVerso(verso.current, donnees, finition)])
      .then(() => { if (actif) setPret(true); });
    return () => { actif = false; };
  }, [ouvert, donnees, finition]);

  const partager = async () => {
    const canvas = retournee ? verso.current : recto.current;
    if (!canvas) return;
    try {
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
      if (!blob) throw new Error("image");
      const fichier = new File([blob], `carte-pick-${donnees.prenom || "moi"}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [fichier] })) {
        await navigator.share({ files: [fichier], text: "Ma Carte Pick 🍿 Découvre la tienne sur Pick !" });
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = fichier.name;
        a.click();
        URL.revokeObjectURL(a.href);
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") toast.error("Impossible de créer l'image de la carte pour le moment.");
    }
  };

  return (
    <AppOverlayPortal>
      <AnimatePresence>
        {ouvert && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center px-6 pb-[calc(5rem+env(safe-area-inset-bottom))]"
            role="dialog"
            aria-label="Ma Carte Pick"
          >
            <div className="absolute top-[calc(0.75rem+env(safe-area-inset-top))] right-3"><CroixRonde onClick={onFermer} /></div>

            <p className="mb-3 text-[11px] font-sans font-semibold uppercase tracking-[0.18em] text-pick-gold">{LIBELLES_RARETE[finition]}</p>

            {/* La carte : deux canvas dos à dos, retournés en 3D. */}
            <button
              type="button"
              onClick={() => setRetournee((v) => !v)}
              aria-label={retournee ? "Voir le recto" : "Voir le verso"}
              className="relative w-full max-w-[300px] [perspective:1400px]"
              style={{ aspectRatio: `${LARGEUR_CARTE} / ${HAUTEUR_CARTE}` }}
            >
              <motion.span
                className="absolute inset-0 block [transform-style:preserve-3d]"
                animate={{ rotateY: retournee ? 180 : 0 }}
                transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <canvas ref={recto} width={LARGEUR_CARTE} height={HAUTEUR_CARTE} className="absolute inset-0 w-full h-full [backface-visibility:hidden] drop-shadow-[0_18px_40px_rgba(0,0,0,0.6)]" />
                <canvas ref={verso} width={LARGEUR_CARTE} height={HAUTEUR_CARTE} className="absolute inset-0 w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)] drop-shadow-[0_18px_40px_rgba(0,0,0,0.6)]" />
              </motion.span>
              {!pret && <span className="absolute inset-0 flex items-center justify-center text-[12px] font-sans text-pick-text-muted">Création de ta carte…</span>}
            </button>

            <div className="mt-5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRetournee((v) => !v)}
                className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full border border-pick-border-hover text-[13px] font-sans font-semibold text-pick-purple-light active:scale-[0.97] transition-transform duration-120 ease-pick"
              >
                <RotateCw className="w-4 h-4" aria-hidden="true" />
                Retourner
              </button>
              <button
                type="button"
                onClick={partager}
                disabled={!pret}
                className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-primary text-primary-foreground text-[13px] font-sans font-semibold shadow-pick-active active:scale-[0.97] transition-transform duration-120 ease-pick disabled:opacity-50"
              >
                <Share2 className="w-4 h-4" aria-hidden="true" />
                Partager
              </button>
            </div>

            {pickPlus && (
              <button
                type="button"
                onClick={() => setHolo((v) => !v)}
                aria-pressed={holo}
                className={`mt-3 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border text-[12px] font-sans font-semibold transition-colors duration-180 ease-pick ${holo ? "border-pick-gold/60 bg-pick-gold/10 text-pick-gold" : "border-pick-border text-pick-text-secondary"}`}
              >
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                Finition nacre · Pick+
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </AppOverlayPortal>
  );
};

export default CartePick;
