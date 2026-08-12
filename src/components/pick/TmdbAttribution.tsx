/**
 * Attribution TMDB — obligation contractuelle, pas une politesse.
 *
 * Les conditions d'utilisation de l'API imposent d'afficher le logo officiel et
 * de préciser que le produit n'est ni approuvé ni certifié par TMDB. Le logo est
 * servi depuis `public/logos/tmdb.svg` : c'est le fichier officiel, il ne doit
 * être ni redessiné, ni recoloré, ni déformé.
 *
 * `compact` sert là où la place manque (fiche film) ; la forme longue va partout
 * où l'utilisateur peut lire une phrase entière (page d'accueil publique, page
 * Confiance).
 */

const TMDB_LOGO = "/logos/tmdb.svg";
const TMDB_URL = "https://www.themoviedb.org/";

const MENTION =
  "Ce produit utilise l'API TMDB mais n'est ni approuvé ni certifié par TMDB.";

interface TmdbAttributionProps {
  compact?: boolean;
  className?: string;
}

const TmdbAttribution = ({ compact = false, className = "" }: TmdbAttributionProps) => {
  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="text-[10px] font-sans text-foreground/35">Données</span>
        <a
          href={TMDB_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="The Movie Database — ce produit n'est ni approuvé ni certifié par TMDB"
          className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          <img src={TMDB_LOGO} alt="The Movie Database" className="h-2.5 w-auto opacity-70" />
        </a>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center gap-2.5 text-center ${className}`}>
      <a
        href={TMDB_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="The Movie Database"
        className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      >
        <img src={TMDB_LOGO} alt="The Movie Database" className="h-3.5 w-auto" />
      </a>
      <p className="text-[11px] font-sans text-foreground/45 leading-relaxed max-w-md">
        {MENTION}
      </p>
    </div>
  );
};

export default TmdbAttribution;
