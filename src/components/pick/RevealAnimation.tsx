/**
 * Cinematic reveal animation — dramatizes the moment Pick finds the perfect movie.
 * After the initial search phases, cinema anecdotes fill the remaining wait time.
 */
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Film, Clapperboard } from "lucide-react";
import PickCharacter from "./PickCharacter";

export type CinemaAnecdote = { text: string; mood: "think" | "wave" | "default" };

interface RevealAnimationProps {
  active: boolean;
  message?: string;
  phase?: "searching" | "found" | "revealing";
  dynamicAnecdotes?: CinemaAnecdote[];
}

const SEARCH_PHASES = [
  { text: "Je parcours ma cinémathèque…", mood: "think" as const, delay: 0 },
  { text: "Hmm, j'ai quelques pistes…", mood: "think" as const, delay: 2000 },
  { text: "Attends, je tiens quelque chose…", mood: "default" as const, delay: 4000 },
  { text: "Ooh, celui-là est parfait.", mood: "wave" as const, delay: 6000 },
];

const CINEMA_ANECDOTES = [
  { text: "Les frères Lumière pensaient que leur invention n'aurait aucun avenir commercial. Ils se trompaient légèrement.", mood: "wave" as const },
  { text: "Marlon Brando improvisait dans Le Parrain — le chat qu'il tient dans la scène d'ouverture n'était pas prévu au scénario.", mood: "think" as const },
  { text: "Le fameux \"Wilhelm Scream\" — un cri enregistré en 1951 — apparaît discrètement dans plus de 400 films, dont Star Wars et Indiana Jones.", mood: "default" as const },
  { text: "Quentin Tarantino n'a aucun diplôme de cinéma. Il a tout appris en travaillant dans un vidéoclub de Los Angeles.", mood: "think" as const },
  { text: "Stanley Kubrick était si perfectionniste qu'il a tourné 127 prises pour une scène de Shining avec Jack Nicholson.", mood: "wave" as const },
  { text: "Chaque année, Bollywood produit plus de films que Hollywood. Le cinéma mondial est bien plus vaste qu'on ne l'imagine.", mood: "think" as const },
  { text: "\"Parasite\" de Bong Joon-ho est le premier film non anglophone à remporter l'Oscar du meilleur film — en 2020.", mood: "default" as const },
  { text: "John Williams a composé plus de 100 bandes originales, dont Star Wars, Indiana Jones, Jaws et Jurassic Park.", mood: "wave" as const },
  { text: "Alfred Hitchcock n'a jamais remporté l'Oscar du meilleur réalisateur malgré 5 nominations. Une des plus grandes injustices de l'Académie.", mood: "think" as const },
  { text: "Le record de figurants dans un film appartient à Gandhi (1982) : 294 560 personnes pour la scène de funérailles.", mood: "default" as const },
  { text: "La salle de cinéma la plus ancienne encore en activité est le Kino Pionier en Pologne, ouvert en 1909.", mood: "think" as const },
  { text: "Le tournage de Apocalypse Now a été si chaotique que le making-of \"Hearts of Darkness\" est lui-même devenu un film culte.", mood: "wave" as const },
  { text: "Heath Ledger s'est enfermé seul dans une chambre d'hôtel pendant 6 semaines pour préparer son rôle de Joker.", mood: "think" as const },
  { text: "La musique de Jaws de Spielberg — deux notes répétées — est l'une des partitions les plus reconnues au monde.", mood: "default" as const },
  { text: "Le cinéma français est le premier producteur de films en Europe avec plus de 300 films par an.", mood: "wave" as const },
  { text: "Tom Hanks a été le premier acteur à remporter l'Oscar du meilleur acteur deux années consécutives depuis Spencer Tracy en 1937-38.", mood: "think" as const },
];

const RevealAnimation = ({ active, message, dynamicAnecdotes }: RevealAnimationProps) => {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [particles, setParticles] = useState<number[]>([]);
  const [anecdoteIndex, setAnecdoteIndex] = useState(0);
  const [showAnecdote, setShowAnecdote] = useState(false);
  const startIndexRef = useRef(Math.floor(Math.random() * CINEMA_ANECDOTES.length));
  // Once dynamic anecdotes arrive, latch onto them and restart from index 0
  const [dynamicLocked, setDynamicLocked] = useState<CinemaAnecdote[] | null>(null);

  // Switch to dynamic anecdotes as soon as they're available and we're in anecdote mode
  useEffect(() => {
    if (dynamicAnecdotes && dynamicAnecdotes.length > 0 && !dynamicLocked) {
      setDynamicLocked(dynamicAnecdotes);
      if (showAnecdote) setAnecdoteIndex(0);
    }
  }, [dynamicAnecdotes, dynamicLocked, showAnecdote]);

  useEffect(() => {
    if (!active) {
      setPhaseIndex(0);
      setParticles([]);
      setShowAnecdote(false);
      setAnecdoteIndex(0);
      setDynamicLocked(null);
      startIndexRef.current = Math.floor(Math.random() * CINEMA_ANECDOTES.length);
      return;
    }

    const phaseTimers = SEARCH_PHASES.map((phase, i) => {
      if (i === 0) return null;
      return setTimeout(() => setPhaseIndex(i), phase.delay);
    }).filter(Boolean);

    // Switch to anecdote mode 2s after the last phase
    const lastDelay = SEARCH_PHASES[SEARCH_PHASES.length - 1].delay;
    const anecdoteTimer = setTimeout(() => setShowAnecdote(true), lastDelay + 2000);

    const particleInterval = setInterval(() => {
      setParticles(prev => [...prev, Date.now()].slice(-8));
    }, 400);

    return () => {
      phaseTimers.forEach(t => t && clearTimeout(t));
      clearTimeout(anecdoteTimer);
      clearInterval(particleInterval);
    };
  }, [active]);

  useEffect(() => {
    if (!showAnecdote || !active) return;
    setAnecdoteIndex(dynamicLocked ? 0 : startIndexRef.current);
    const pool = dynamicLocked ?? CINEMA_ANECDOTES;
    const interval = setInterval(() => {
      setAnecdoteIndex(prev => (prev + 1) % pool.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [showAnecdote, active, dynamicLocked]);

  if (!active) return null;

  const activePool = dynamicLocked ?? CINEMA_ANECDOTES;
  const currentPhase = SEARCH_PHASES[phaseIndex];
  const currentAnecdote = activePool[anecdoteIndex % activePool.length];
  const characterMood = showAnecdote ? currentAnecdote.mood : currentPhase.mood;
  const progress = ((phaseIndex + 1) / SEARCH_PHASES.length) * 100;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-md"
    >
      {/* Ambient sparkle particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((id) => (
          <motion.div
            key={id}
            initial={{ opacity: 0, x: Math.random() * 100 + "%", y: Math.random() * 100 + "%", scale: 0 }}
            animate={{ opacity: [0, 0.6, 0], scale: [0, 1.2, 0], y: `${Math.random() * 80 + 10}%` }}
            transition={{ duration: 2, ease: "easeOut" }}
            className="absolute"
          >
            <Sparkles className="w-3 h-3 text-primary/40" />
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col items-center gap-6 px-8 max-w-sm w-full">
        {/* Pick character */}
        <motion.div
          animate={{
            scale: [1, 1.05, 1],
            rotate: !showAnecdote && phaseIndex >= 3 ? [0, -3, 3, 0] : 0,
          }}
          transition={{
            scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
            rotate: { duration: 0.5, ease: "easeInOut" },
          }}
        >
          <PickCharacter mood={characterMood} size="lg" animate />
        </motion.div>

        {/* Content area */}
        <AnimatePresence mode="wait">
          {showAnecdote ? (
            <motion.div
              key={`anecdote-${anecdoteIndex}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4 }}
              className="text-center"
            >
              <div className="flex items-center justify-center gap-1.5 mb-2">
                <Clapperboard className="w-3.5 h-3.5 text-primary/60" />
                <span className="text-xs font-medium text-primary/60 uppercase tracking-wider">Le saviez-vous ?</span>
              </div>
              <p className="text-foreground/80 text-sm font-sans leading-relaxed max-w-[300px]">
                {currentAnecdote.text}
              </p>
            </motion.div>
          ) : (
            <motion.div
              key={`phase-${message || currentPhase.text}`}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="text-center max-w-[280px]"
            >
              <p className="text-foreground/80 text-base font-sans font-medium leading-relaxed">
                {message || currentPhase.text}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress bar */}
        <div className="w-48 h-1 rounded-full bg-foreground/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary"
            initial={{ width: 0 }}
            animate={{ width: showAnecdote ? "100%" : `${progress}%` }}
            transition={{ duration: showAnecdote ? 0.8 : 1.5, ease: "easeOut" }}
          />
        </div>

        {/* Film reel */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="text-primary/20"
        >
          <Film className="w-5 h-5" />
        </motion.div>
      </div>
    </motion.div>
  );
};

export default RevealAnimation;
