import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Search, BookOpen, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface GlossaryEntry {
  term: string;
  definition: string;
  example?: string;
}

const GLOSSARY: GlossaryEntry[] = [
  { term: "Twist ending", definition: "Un retournement de situation inattendu à la fin du film qui change complètement la compréhension de l'histoire.", example: "Sixième Sens, Fight Club" },
  { term: "Slow burn", definition: "Un film qui construit progressivement sa tension et son atmosphère, prenant son temps pour captiver le spectateur.", example: "There Will Be Blood, Under the Skin" },
  { term: "Feel-good", definition: "Un film conçu pour mettre de bonne humeur, avec une histoire positive et réconfortante.", example: "Intouchables, Little Miss Sunshine" },
  { term: "Whodunit", definition: "Un sous-genre du policier centré sur l'énigme : qui est le coupable ? Le spectateur mène l'enquête avec les personnages.", example: "À Couteaux Tirés, Cluedo" },
  { term: "Found footage", definition: "Film tourné comme s'il s'agissait de véritables images retrouvées, souvent en caméra amateur pour un effet réaliste.", example: "Blair Witch Project, Cloverfield" },
  { term: "Film noir", definition: "Genre cinématographique caractérisé par une atmosphère sombre, des personnages moralement ambigus et des intrigues criminelles.", example: "Le Faucon Maltais, Chinatown" },
  { term: "Coming-of-age", definition: "Film centré sur le passage de l'adolescence à l'âge adulte, explorant la découverte de soi et la maturité.", example: "Stand by Me, Lady Bird" },
  { term: "Blockbuster", definition: "Film à gros budget conçu pour attirer le plus large public possible, avec des effets spectaculaires.", example: "Avengers, Jurassic Park" },
  { term: "Film d'auteur", definition: "Film portant la vision personnelle et artistique de son réalisateur, souvent plus exigeant et original.", example: "Mulholland Drive, 8½" },
  { term: "Buddy movie", definition: "Film reposant sur la dynamique entre deux personnages principaux, souvent très différents l'un de l'autre.", example: "Midnight Run, Lethal Weapon" },
  { term: "Cliffhanger", definition: "Fin d'un épisode ou d'un film qui laisse le spectateur en suspens, créant une forte envie de connaître la suite.", example: "L'Empire contre-attaque" },
  { term: "MacGuffin", definition: "Un objet ou objectif qui motive les personnages mais dont la nature exacte importe peu pour le spectateur.", example: "La mallette dans Pulp Fiction" },
  { term: "Jump scare", definition: "Technique d'horreur qui surprend le spectateur avec un événement soudain et effrayant, souvent accompagné d'un son fort.", example: "Insidious, Conjuring" },
  { term: "Road movie", definition: "Film dont l'intrigue se déroule principalement pendant un voyage, souvent une métaphore de transformation personnelle.", example: "Thelma & Louise, Into the Wild" },
  { term: "Néo-noir", definition: "Reprise moderne du film noir classique, avec des thèmes contemporains mais la même atmosphère sombre.", example: "Drive, Blade Runner 2049" },
  { term: "Thriller psychologique", definition: "Film qui joue avec l'esprit du spectateur en créant du suspense à travers la manipulation, le doute et la paranoïa.", example: "Gone Girl, Black Swan" },
  { term: "Space opera", definition: "Sous-genre de la science-fiction avec des aventures épiques dans l'espace, des batailles interstellaires et des univers grandioses.", example: "Star Wars, Dune" },
  { term: "Dystopie", definition: "Film se déroulant dans une société future oppressive et cauchemardesque, souvent une critique de dérives actuelles.", example: "1984, Hunger Games" },
  { term: "Mockumentaire", definition: "Film de fiction qui imite le style du documentaire pour un effet comique ou satirique.", example: "This Is Spinal Tap, Borat" },
  { term: "Slasher", definition: "Sous-genre de l'horreur où un tueur masqué élimine ses victimes une par une, souvent des adolescents.", example: "Scream, Halloween" },
  { term: "Survival", definition: "Film où le personnage principal doit lutter pour sa survie dans des conditions extrêmes.", example: "The Revenant, Seul au monde" },
  { term: "Bande originale (BO)", definition: "L'ensemble des musiques composées ou sélectionnées spécifiquement pour accompagner un film.", example: "Interstellar (Hans Zimmer)" },
  { term: "Cinématographie", definition: "L'art de la mise en images : cadrage, lumière, mouvements de caméra. Ce qui rend un film visuellement beau ou marquant." },
  { term: "Plan-séquence", definition: "Une scène filmée en une seule prise continue, sans coupure de montage, créant un effet immersif.", example: "Les Fils de l'Homme, Birdman" },
  { term: "Mise en abyme", definition: "Un film dans le film : quand l'histoire parle elle-même de cinéma ou reflète sa propre structure.", example: "Inception, Adaptation" },
  { term: "Montage parallèle", definition: "Technique de montage alternant entre deux scènes se déroulant simultanément pour créer du suspense ou des parallèles.", example: "Le Parrain (scène du baptême)" },
  { term: "Quatre-murs", definition: "Film qui se déroule entièrement ou presque dans un seul lieu confiné, créant un huis clos intense.", example: "12 Hommes en Colère, The Room" },
  { term: "Reboot", definition: "Nouvelle version d'une franchise qui recommence l'histoire depuis le début, sans lien avec les films précédents.", example: "Batman Begins, Spider-Man (2012)" },
  { term: "Spin-off", definition: "Film dérivé d'une œuvre existante, centré sur un personnage secondaire ou un aspect de l'univers original.", example: "Rogue One, Better Call Saul" },
  { term: "Easter egg", definition: "Référence cachée ou clin d'œil discret glissé dans un film par le réalisateur, destiné aux spectateurs attentifs." },
  { term: "Scores TMDB", definition: "Notes attribuées par la communauté sur The Movie Database, la base de données que Pick utilise. Échelle de 0 à 10." },
];

const Glossary = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [expandedTerm, setExpandedTerm] = useState<string | null>(null);

  const filtered = search.trim()
    ? GLOSSARY.filter(e =>
        e.term.toLowerCase().includes(search.toLowerCase()) ||
        e.definition.toLowerCase().includes(search.toLowerCase())
      )
    : GLOSSARY;

  return (
    <div className="fixed inset-0 bg-background overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/10 px-5 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-foreground/60 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <BookOpen className="w-4 h-4 text-primary/60" />
          <h1 className="font-serif text-lg">Lexique Cinéma</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-6 pb-32">
        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un terme…"
            className="w-full pl-10 pr-10 py-3 rounded-xl bg-card border border-border/20 text-foreground text-sm font-sans placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground font-sans mb-4">
          {filtered.length} terme{filtered.length > 1 ? "s" : ""}
        </p>

        {/* Glossary List */}
        <div className="space-y-2">
          {filtered.map((entry) => (
            <motion.div
              key={entry.term}
              layout
              className="rounded-xl bg-card border border-border/10 overflow-hidden"
            >
              <button
                onClick={() => setExpandedTerm(expandedTerm === entry.term ? null : entry.term)}
                className="w-full text-left px-4 py-3 flex items-center justify-between gap-3"
              >
                <span className="text-sm font-sans font-semibold text-foreground">{entry.term}</span>
                <motion.span
                  animate={{ rotate: expandedTerm === entry.term ? 45 : 0 }}
                  className="text-muted-foreground text-lg font-light shrink-0"
                >
                  +
                </motion.span>
              </button>
              <AnimatePresence>
                {expandedTerm === entry.term && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-3 border-t border-border/10 pt-2">
                      <p className="text-[13px] font-sans text-foreground/70 leading-relaxed">
                        {entry.definition}
                      </p>
                      {entry.example && (
                        <p className="text-[11px] text-primary/60 font-sans mt-2">
                          Ex : {entry.example}
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Glossary;
