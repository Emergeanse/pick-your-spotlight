import { motion } from "framer-motion";
import SignaturesAdn from "./SignaturesAdn";
import { signaturesAdn } from "@/lib/signatures";
import { Sparkles } from "lucide-react";
import { TRAITS, evolutionAdn, fiabiliteAdn, traitsDominants, type Adn } from "@/lib/adn";

/**
 * « Ton ADN cinéma » : la signature de goût, en constellation à six branches
 * plutôt qu'en radar de tableau de bord. Chaque profil a une forme différente.
 *
 * - en tête : les trois mots dominants et la phrase de Pick ;
 * - la constellation (six traits, 50 = moyenne du catalogue) ;
 * - les traits dominants, puis l'évolution du mois ;
 * - les univers favoris (genres) en capsules, sans pourcentage trompeur.
 */
interface AdnCinemaProps {
  adn: Adn | null;
  adnRecent: Adn | null;
  narrative: string | null;
  genres: string[];
  titre?: string;
  /** Archétype de Pick (« Architecte de tension »), affiché en tête. */
  archetype?: string | null;
  /** Indice de confiance du moteur (0–100), pour la fiabilité. */
  confiance?: number | null;
  /**
   * Version allégée (personne croisée en soirée) : la forme de la
   * constellation reste, les chiffres disparaissent.
   */
  chiffresMasques?: boolean;
  /** « Vous et Chris » : affinité (amis seulement) et phrase de comparaison. */
  comparaison?: { prenom: string; affinite: number | null; phrase: string } | null;
}

// Plus large que haut : les libellés des côtés (« Contemplation ») ont besoin de place.
const LARGEUR = 340;
const HAUTEUR = 260;
const CX = LARGEUR / 2;
const CY = HAUTEUR / 2;
const RAYON = 92;

function point(index: number, valeur: number) {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / TRAITS.length;
  const r = (RAYON * valeur) / 100;
  return { x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle), angle };
}

function Constellation({ adn, chiffresMasques = false }: { adn: Adn; chiffresMasques?: boolean }) {
  const sommets = TRAITS.map((t, i) => ({ ...point(i, adn[t.id]), t }));
  // Les trois traits dominants brillent un peu plus fort.
  const dominants = new Set(traitsDominants(adn).map((d) => d.id));
  const forme = sommets.map((s) => `${s.x.toFixed(1)},${s.y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`} className="w-full max-w-[340px] mx-auto" role="img"
      aria-label={chiffresMasques ? `Constellation de goûts, dominantes : ${traitsDominants(adn).map((d) => d.libelle).join(", ")}` : `Constellation de goûts : ${TRAITS.map((t) => `${t.libelle} ${adn[t.id]}`).join(", ")}`}>
      <defs>
        <radialGradient id="adn-fond" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.22" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="adn-forme" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#d946ef" stopOpacity="0.25" />
        </linearGradient>
        <filter id="adn-lueur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="flou" />
          <feMerge><feMergeNode in="flou" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <circle cx={CX} cy={CY} r={RAYON + 18} fill="url(#adn-fond)" />
      {/* Repère discret : la moyenne du catalogue (50) et le bord (100). */}
      {[50, 100].map((v) => (
        <circle key={v} cx={CX} cy={CY} r={(RAYON * v) / 100} fill="none"
          stroke="rgba(167,139,250,0.14)" strokeDasharray={v === 50 ? "2 4" : undefined} />
      ))}
      {TRAITS.map((t, i) => {
        const bout = point(i, 100);
        return <line key={t.id} x1={CX} y1={CY} x2={bout.x} y2={bout.y} stroke="rgba(167,139,250,0.12)" />;
      })}
      <motion.polygon
        points={forme}
        fill="url(#adn-forme)"
        stroke="#c4b5fd"
        strokeOpacity="0.8"
        strokeWidth="1.5"
        strokeLinejoin="round"
        filter="url(#adn-lueur)"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{ transformOrigin: `${CX}px ${CY}px` }}
        transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
      />
      {sommets.map((s) => (
        <circle key={s.t.id} cx={s.x} cy={s.y} r={dominants.has(s.t.id) ? 4.5 : 2.5} fill="#f5f3ff" filter="url(#adn-lueur)" />
      ))}
      {TRAITS.map((t, i) => {
        const p = point(i, 114);
        const ancre = Math.abs(Math.cos(p.angle)) < 0.2 ? "middle" : Math.cos(p.angle) > 0 ? "start" : "end";
        return (
          <text key={t.id} x={p.x} y={p.y} textAnchor={ancre} dominantBaseline="middle"
            className="fill-[#a8a3b3] text-[11px] font-sans font-medium">
            {t.libelle}
          </text>
        );
      })}
    </svg>
  );
}

export default function AdnCinema({ adn, adnRecent, narrative, genres, titre = "Ton ADN cinéma", archetype, confiance, chiffresMasques = false, comparaison }: AdnCinemaProps) {
  const dominants = adn ? traitsDominants(adn) : [];
  const evolution = evolutionAdn(adn, adnRecent);
  const fiabilite = fiabiliteAdn(confiance);
  const signatures = signaturesAdn(adn, genres);
  if (!adn && genres.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 }}
      className="rounded-pick-xl border border-pick-border bg-pick-surface/90 shadow-pick-card p-4"
    >
      <div className="flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-pick-purple-light" aria-hidden="true" />
        <h2 className="text-[11px] font-sans font-semibold tracking-[0.14em] uppercase text-pick-purple-light">{titre}</h2>
      </div>

      {archetype && (
        <p className="mt-2 text-[18px] font-sans font-bold uppercase tracking-wide text-foreground leading-tight">{archetype}</p>
      )}
      {dominants.length > 0 && (
        <p className={`${archetype ? "mt-0.5 text-[14px] font-semibold text-pick-purple-light" : "mt-2 text-[16px] font-bold text-foreground"} font-sans capitalize`}>
          {dominants.map((d) => d.adjectif).join(" · ")}
        </p>
      )}
      {narrative && <p className="mt-1.5 text-[13px] font-sans text-pick-text-secondary leading-snug">{narrative}</p>}

      {/* Signatures : l'ADN en trois ou quatre mots, visibles aussi des amis. */}
      {signatures.length > 0 && <div className="mt-3"><SignaturesAdn signatures={signatures} /></div>}

      {adn && (
        <>
          <div className="mt-3"><Constellation adn={adn} chiffresMasques={chiffresMasques} /></div>

          {comparaison && (
            <div className="mt-2 rounded-pick-md border border-pick-border-hover bg-primary/[0.08] px-3 py-2.5">
              <p className="text-[12px] font-sans font-semibold text-foreground">
                Vous et {comparaison.prenom}
                {comparaison.affinite != null && (
                  <span className="ml-1.5 text-pick-purple-light">· {comparaison.affinite} % d&apos;affinité cinéma</span>
                )}
              </p>
              <p className="mt-0.5 text-[12px] font-sans text-pick-text-secondary leading-snug">{comparaison.phrase}</p>
            </div>
          )}

          {!chiffresMasques && (
            <>
              <h3 className="mt-2 text-[11px] font-sans font-semibold tracking-[0.14em] uppercase text-pick-text-secondary">Traits dominants</h3>
              <ul className="mt-2 grid grid-cols-3 gap-2">
                {dominants.map((d) => (
                  <li key={d.id} className="rounded-pick-md border border-pick-border bg-background/40 px-2 py-2 text-center">
                    <span className="block text-[11px] font-sans text-pick-text-secondary">{d.libelle}</span>
                    <span className="block text-[20px] font-sans font-bold text-foreground tabular-nums leading-tight">{d.valeur}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-[11px] font-sans text-pick-text-muted">50 = la moyenne des films de Pick.</p>
            </>
          )}

          {fiabilite && (
            <div className="mt-3 flex items-start gap-2.5">
              <span className="mt-0.5 flex gap-0.5 shrink-0" aria-hidden="true">
                {[1, 2, 3].map((n) => (
                  <span key={n} className={`w-1.5 h-3.5 rounded-full ${n <= fiabilite.niveau ? "bg-pick-purple-light" : "bg-foreground/15"}`} />
                ))}
              </span>
              <p className="text-[12px] font-sans text-pick-text-secondary leading-snug">
                <span className="font-semibold text-foreground">{fiabilite.libelle}</span> — {fiabilite.detail}
                {fiabilite.conseil && <span className="block text-pick-text-muted">{fiabilite.conseil}</span>}
              </p>
            </div>
          )}

          {evolution.length > 0 && (
            <div className="mt-3 rounded-pick-md border border-pick-border bg-primary/[0.06] px-3 py-2">
              <p className="text-[12px] font-sans font-semibold text-foreground">Ton ADN évolue</p>
              <p className="text-[12px] font-sans text-pick-text-secondary mt-0.5">
                {evolution.map((e) => `${e.ecart > 0 ? "+" : "−"}${Math.abs(e.ecart)} ${e.libelle}`).join(" · ")} ce mois-ci
              </p>
            </div>
          )}
        </>
      )}

      {genres.length > 0 && (
        <>
          <h3 className="mt-4 text-[11px] font-sans font-semibold tracking-[0.14em] uppercase text-pick-text-secondary">Univers favoris</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {genres.slice(0, 6).map((g) => (
              <span key={g} className="px-2.5 py-1 rounded-full border border-pick-border-hover bg-primary/10 text-[12px] font-sans font-medium text-pick-purple-light">
                {g}
              </span>
            ))}
          </div>
        </>
      )}
    </motion.section>
  );
}
