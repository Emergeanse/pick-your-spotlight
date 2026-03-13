import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Target, Dice5, Mic, Brain, Tv, ChevronDown, Clapperboard, MessageCircle, Volume2, Zap, SlidersHorizontal } from "lucide-react";
import pickLogo from "@/assets/pick-logo.png";
import pickWave from "@/assets/pick-squirrel-wave.png";
import pickThink from "@/assets/pick-squirrel-think.png";
import pickDefault from "@/assets/pick-squirrel.png";

const POSTER_URLS = [
  "https://image.tmdb.org/t/p/w342/qJ2tW6WMUDux911BTUgMe1cEgGR.jpg",
  "https://image.tmdb.org/t/p/w342/d5NXSklXo0qyIYkgV94XAgMIckC.jpg",
  "https://image.tmdb.org/t/p/w342/rCzpDGLbOoPwLjy3OAm5NUPOTrC.jpg",
  "https://image.tmdb.org/t/p/w342/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
  "https://image.tmdb.org/t/p/w342/7WsyChQLEftFiDhRhUg3IxFrz5g.jpg",
  "https://image.tmdb.org/t/p/w342/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
  "https://image.tmdb.org/t/p/w342/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg",
  "https://image.tmdb.org/t/p/w342/1E5baAaEse26fej7uHcjOgEERB2.jpg",
  "https://image.tmdb.org/t/p/w342/sv1xJUazXeYqALzczSZ3O6nkH75.jpg",
  "https://image.tmdb.org/t/p/w342/udDclJoHjfjb8Ekgsd4FDteOkCU.jpg",
  "https://image.tmdb.org/t/p/w342/dB6Krk806zeqd0YNp2ngQ9zXteH.jpg",
  "https://image.tmdb.org/t/p/w342/3bhkrj58Vtu7enYsRolD1fZdja1.jpg",
];

const PLATFORM_LOGOS = [
  { name: "Netflix", logo: "https://image.tmdb.org/t/p/original/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg" },
  { name: "Disney+", logo: "https://image.tmdb.org/t/p/original/97yvRBw1GzX7fXprcF80er19ot.jpg" },
  { name: "Amazon Prime", logo: "https://image.tmdb.org/t/p/original/pvske1MyAoymrs5bguRfVqYiM9a.jpg" },
  { name: "Apple TV+", logo: "https://image.tmdb.org/t/p/original/mcbz1LgtErU9p4UdbZ0rG6RTWHX.jpg" },
  { name: "Canal+", logo: "https://image.tmdb.org/t/p/original/geOzgeKZWpZC3lymAVEHVIk3X0q.jpg" },
  { name: "Max", logo: "https://image.tmdb.org/t/p/original/6Q3YKUNA60A4DxOrPaUTDOE4BrU.jpg" },
  { name: "Paramount+", logo: "https://image.tmdb.org/t/p/original/fi83B1ozBIOCEo7cWoevSYS0tXi.jpg" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: [0.25, 0.1, 0.25, 1] as const },
  }),
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

// Messages qui défilent pour montrer les capacités de Pick
const SCROLLING_MESSAGES = [
  "Un thriller sous-estimé des années 2000",
  "Une série aussi addictive que Breaking Bad",
  "Un film comme Gone Girl mais moins connu",
  "Une mini-série parfaite pour un week-end",
  "Un film qui retourne le cerveau",
];

// Composant pour les messages défilants
const ScrollingRequests = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % SCROLLING_MESSAGES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Message utilisateur qui change */}
      <div className="self-end overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            className="px-4 py-2.5 rounded-2xl rounded-br-md bg-primary/15 border border-primary/20 max-w-[280px]"
          >
            <p className="text-foreground/80 text-[14px] font-sans text-right">
              {SCROLLING_MESSAGES[currentIndex]}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Réponse fixe de Pick */}
      <div className="self-start flex items-end gap-2">
        <img src={pickDefault} alt="Pick" className="w-7 h-7 object-contain flex-shrink-0" />
        <div className="px-4 py-2.5 rounded-2xl rounded-bl-md bg-card/60 border border-border/20">
          <p className="text-foreground/70 text-[14px] font-sans">J'ai exactement ce qu'il te faut ! ✨</p>
        </div>
      </div>

      {/* Indicateurs de progression */}
      <div className="flex gap-1.5 mt-1">
        {SCROLLING_MESSAGES.map((_, index) => (
          <motion.div
            key={index}
            className="w-1.5 h-1.5 rounded-full"
            animate={{
              backgroundColor: index === currentIndex ? "hsl(var(--primary))" : "hsl(var(--border))",
              scale: index === currentIndex ? 1.2 : 1,
            }}
            transition={{ duration: 0.3 }}
          />
        ))}
      </div>
    </div>
  );
};

const Landing = () => {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 1.1]);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/60 backdrop-blur-xl border-b border-border/10">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-5 h-14">
          <div className="flex items-center gap-2">
            <img src={pickLogo} alt="Pick" className="w-6 h-6 object-contain invert brightness-200" />
            <span className="font-serif text-xl tracking-wide">Pick</span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="text-foreground/60 hover:text-foreground font-sans text-sm"
              onClick={() => navigate("/auth")}
            >
              Connexion
            </Button>
            <Button
              size="sm"
              className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-sans text-sm px-4 neon-glow"
              onClick={() => navigate("/app")}
            >
              <Clapperboard className="w-3.5 h-3.5 mr-1.5" />
              Essayer Pick
            </Button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Poster grid background */}
        <motion.div style={{ scale: heroScale }} className="absolute inset-0">
          <div className="absolute inset-0 grid grid-cols-4 md:grid-cols-6 gap-1 opacity-[0.08]">
            {POSTER_URLS.map((url, i) => (
              <motion.img
                key={i}
                src={url}
                alt=""
                className="w-full aspect-[2/3] object-cover"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.08, duration: 0.6 }}
              />
            ))}
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-background via-background/80 to-background" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-background" />
        </motion.div>

        {/* Radial glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
        </div>

        <motion.div
          style={{ opacity: heroOpacity }}
          className="relative z-10 max-w-3xl mx-auto px-5 text-center"
        >
          {/* Pick mascot with speech bubble */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1, type: "spring", stiffness: 200 }}
            className="mb-6 flex flex-col items-center"
          >
            {/* Speech bubble */}
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="relative max-w-[240px] px-4 py-2.5 rounded-2xl bg-card/80 backdrop-blur-sm border border-border/30 shadow-lg mb-3"
            >
              <p className="text-foreground/80 text-[13px] font-sans leading-relaxed text-center">
                Alors… on regarde quoi ce soir ? 🍿
              </p>
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-card/80 border-r border-b border-border/30" />
            </motion.div>
            <img src={pickWave} alt="Pick" className="w-24 h-24 md:w-32 md:h-32 object-contain drop-shadow-xl pick-float" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/8 border border-primary/15 mb-6"
          >
            <Sparkles className="w-3 h-3 text-primary/60" />
            <span className="text-primary/60 text-[11px] font-sans font-medium">Propulsé par l'IA</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="text-4xl md:text-6xl lg:text-7xl font-serif leading-[1.05] mb-5"
          >
            Le bon film.{" "}
            <span className="text-primary italic">Ce soir.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="text-foreground/50 text-base md:text-lg font-sans font-light max-w-md mx-auto mb-8 leading-relaxed"
          >
            Dis ton envie. Pick trouve ton film.
          </motion.p>

          {/* Mini conversation avec messages défilants */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.65 }}
            className="max-w-xs mx-auto mb-8"
          >
            <ScrollingRequests />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            className="flex flex-col items-center gap-3"
          >
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Button
                size="lg"
                className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-sans font-semibold px-7 h-12 gap-2.5 text-base neon-glow transition-all active:scale-[0.97]"
                onClick={() => navigate("/app")}
              >
                <Clapperboard className="w-4 h-4" />
                Demander à Pick
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="rounded-full text-foreground/60 hover:text-foreground font-sans font-medium px-6 h-12 gap-2 text-base border border-border/20 hover:border-border/40 transition-all"
                onClick={() => navigate("/app")}
              >
                <Dice5 className="w-4 h-4" />
                Surprends-moi
              </Button>
            </div>

            <span className="text-foreground/40 text-xs font-sans font-medium tracking-wide">
              Gratuit — aucune inscription
            </span>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          >
            <ChevronDown className="w-5 h-5 text-foreground/20" />
          </motion.div>
        </motion.div>
      </section>

      {/* ── MEET PICK ── */}
      <section className="py-24 md:py-32 px-5 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[500px] h-[500px] rounded-full bg-primary/4 blur-[100px]" />
        </div>

        <div className="max-w-4xl mx-auto relative z-10">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-serif mb-4">
              Rencontre <span className="text-primary italic">Pick</span>
            </h2>
            <p className="text-foreground/40 font-sans text-sm md:text-base max-w-lg mx-auto">
              Un cinéphile passionné avec béret et lunettes rondes, 
              qui a vu plus de films que tu ne pourras jamais en regarder.
            </p>
          </motion.div>

          {/* Pick showcase — 3 moods */}
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto"
          >
            {[
              {
                img: pickWave,
                title: "Il t'accueille",
                desc: "Pick te demande ton humeur, avec qui tu regardes et combien de temps tu as.",
                mood: "Accueil",
              },
              {
                img: pickThink,
                title: "Il réfléchit",
                desc: "Il fouille dans sa mémoire cinématographique pour trouver le film parfait.",
                mood: "Réflexion",
              },
              {
                img: pickDefault,
                title: "Il te présente",
                desc: "Il t'explique pourquoi ce film est fait pour toi, et peut même te le raconter à voix haute.",
                mood: "Présentation",
              },
            ].map((item, i) => (
              <motion.div
                key={item.mood}
                variants={fadeUp}
                custom={i}
                className="text-center p-6 md:p-8 rounded-2xl bg-card/40 border border-border/15 hover:border-primary/20 transition-all duration-300"
              >
                <img
                  src={item.img}
                  alt={item.mood}
                  className="w-20 h-20 md:w-24 md:h-24 object-contain mx-auto mb-4 drop-shadow-lg"
                />
                <span className="text-[10px] uppercase tracking-widest text-primary/60 font-sans font-semibold">
                  {item.mood}
                </span>
                <h3 className="text-lg font-serif mt-1 mb-2">{item.title}</h3>
                <p className="text-foreground/40 text-sm font-sans leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-24 md:py-32 px-5">
        <div className="max-w-5xl mx-auto">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-serif mb-3">
              Comment ça marche
            </h2>
            <p className="text-foreground/40 font-sans text-sm md:text-base max-w-md mx-auto">
              Trois façons de trouver ton film. Zéro prise de tête.
            </p>
          </motion.div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            className="grid md:grid-cols-3 gap-4 md:gap-6"
          >
            {[
              {
                icon: <Zap className="w-5 h-5" />,
                title: "⚡ Pick pour ce soir",
                desc: "Un seul tap et Pick te trouve le film parfait immédiatement. Pas de questions, pas de listes.",
                label: "Instant",
              },
              {
                icon: <Mic className="w-5 h-5" />,
                title: "🎙 Parle à Pick",
                desc: "Dis-lui ce que tu veux en langage naturel : « un truc qui fait peur mais pas trop ». Il comprend.",
                label: "Vocal",
              },
              {
                icon: <SlidersHorizontal className="w-5 h-5" />,
                title: "🎬 Choisis toi-même",
                desc: "Quelques questions rapides sur ton humeur, le temps disponible et avec qui tu regardes.",
                label: "Guidé",
              },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                variants={fadeUp}
                custom={i}
                className="relative group bg-card/50 border border-border/15 rounded-2xl p-6 md:p-8 hover:border-primary/20 transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 text-primary group-hover:bg-primary/15 transition-colors">
                  {item.icon}
                </div>
                <span className="text-[10px] uppercase tracking-widest text-primary/60 font-sans font-semibold">
                  {item.label}
                </span>
                <h3 className="text-lg md:text-xl font-serif mb-2 mt-1">{item.title}</h3>
                <p className="text-foreground/40 text-sm font-sans leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── PICK VOICE ── */}
      <section className="py-24 md:py-32 px-5 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[500px] h-[400px] rounded-full bg-primary/3 blur-[100px]" />
        </div>

        <div className="max-w-4xl mx-auto relative z-10">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="flex flex-col md:flex-row items-center gap-10 md:gap-16"
          >
            {/* Pick mascot with film reel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="flex-shrink-0"
            >
              <div className="relative">
                <img src={pickDefault} alt="Pick" className="w-32 h-32 md:w-40 md:h-40 object-contain drop-shadow-xl pick-float" />
                {/* Speech bubble */}
                <div className="absolute -top-4 -right-4 md:-right-8 px-3 py-2 rounded-xl bg-primary/15 border border-primary/25 backdrop-blur-sm">
                  <Volume2 className="w-4 h-4 text-primary" />
                </div>
              </div>
            </motion.div>

            {/* Text */}
            <div className="text-center md:text-left">
              <h2 className="text-3xl md:text-4xl font-serif mb-4">
                Pick peut te <span className="text-primary italic">raconter</span> le film
              </h2>
              <p className="text-foreground/45 font-sans text-sm md:text-base leading-relaxed mb-4">
                Écoute Pick te présenter le film à voix haute. Il t'explique pourquoi c'est le bon choix pour toi, 
                avec sa voix unique. Comme un ami cinéphile qui partage ses coups de cœur.
              </p>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/25">
                <Volume2 className="w-4 h-4 text-primary" />
                <span className="text-foreground/60 text-sm font-sans">« Je peux te présenter ce film si tu veux »</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── PERSONALIZATION ── */}
      <section className="py-24 md:py-32 px-5">
        <div className="max-w-5xl mx-auto">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-serif mb-3">
              Plus tu l'utilises, plus il te{" "}
              <span className="text-primary italic">connaît</span>
            </h2>
            <p className="text-foreground/40 font-sans text-sm md:text-base max-w-lg mx-auto">
              Pick apprend tes goûts et affine ses recommandations au fil du temps.
            </p>
          </motion.div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto"
          >
            {[
              { icon: <Target className="w-4 h-4" />, text: "Analyse les films que tu aimes et ceux que tu passes", tag: "Profil de goût" },
              { icon: <Brain className="w-4 h-4" />, text: "S'adapte à ton humeur et ton contexte en temps réel", tag: "Contexte" },
              { icon: <Sparkles className="w-4 h-4" />, text: "Utilise l'IA pour trouver des connexions entre tes films préférés", tag: "IA" },
              { icon: <MessageCircle className="w-4 h-4" />, text: "Compagnon de visionnage : pose des questions pendant le film", tag: "Compagnon" },
            ].map((item, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                custom={i}
                className="flex items-start gap-4 p-5 rounded-xl bg-card/30 border border-border/10 hover:border-primary/15 transition-all"
              >
                <div className="mt-0.5 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
                  {item.icon}
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-primary/60 font-sans font-semibold">
                    {item.tag}
                  </span>
                  <p className="text-foreground/60 font-sans text-sm mt-1">{item.text}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Taste tags */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="flex flex-wrap justify-center gap-2 mt-12"
          >
            {["Thriller", "Feel Good", "Sombre", "Époustouflant", "Cosy", "Slow Burn", "Visuellement dingue", "Twist final"].map((tag, i) => (
              <motion.span
                key={tag}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.6 + i * 0.05 }}
                className="px-3 py-1.5 rounded-full bg-card/60 border border-border/15 text-foreground/40 text-xs font-sans"
              >
                {tag}
              </motion.span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── PLATFORMS ── */}
      <section className="py-24 md:py-32 px-5 relative">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[400px] h-[300px] rounded-full bg-primary/3 blur-[100px]" />
        </div>

        <div className="max-w-4xl mx-auto relative z-10 text-center">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <h2 className="text-3xl md:text-5xl font-serif mb-3">
              Tous tes services de streaming
            </h2>
            <p className="text-foreground/40 font-sans text-sm md:text-base max-w-lg mx-auto mb-12">
              Pick sait où regarder chaque film. Netflix, Disney+, Amazon… il te dit tout.
            </p>
          </motion.div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            className="flex items-center justify-center gap-4 md:gap-6 flex-wrap"
          >
            {PLATFORM_LOGOS.map((p, i) => (
              <motion.div
                key={p.name}
                variants={fadeUp}
                custom={i}
                className="flex flex-col items-center gap-2"
              >
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl overflow-hidden border border-border/15 hover:border-primary/25 transition-all duration-300 hover:scale-105">
                  <img src={p.logo} alt={p.name} className="w-full h-full object-cover" />
                </div>
                <span className="text-[10px] font-sans text-foreground/30">{p.name}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-24 md:py-32 px-5 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/3 to-transparent" />

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="max-w-3xl mx-auto text-center relative z-10"
        >
          {/* Pick thinking */}
          <motion.img
            src={pickThink}
            alt="Pick réfléchit"
            className="w-16 h-16 md:w-20 md:h-20 object-contain mx-auto mb-6 drop-shadow-lg"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          />

          <h2 className="text-3xl md:text-5xl lg:text-6xl font-serif mb-4">
            Arrête de scroller.{" "}
            <span className="text-primary italic">Regarde.</span>
          </h2>
          <p className="text-foreground/40 font-sans text-sm md:text-base max-w-md mx-auto mb-8">
            Pick est prêt à trouver ton prochain coup de cœur.
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Button
              size="lg"
              className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-sans font-semibold px-7 h-12 gap-2.5 text-base neon-glow transition-all active:scale-[0.97]"
              onClick={() => navigate("/app")}
            >
              <Clapperboard className="w-4 h-4" />
              Demander à Pick
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="rounded-full text-foreground/60 hover:text-foreground font-sans font-medium px-6 h-12 gap-2 text-base border border-border/20 hover:border-border/40 transition-all"
              onClick={() => navigate("/app")}
            >
              <Dice5 className="w-4 h-4" />
              Surprends-moi
            </Button>
          </div>

          <p className="text-foreground/20 text-xs font-sans mt-4">
            Gratuit · Sans inscription
          </p>
        </motion.div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-border/10 py-10 px-5">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <img src={pickLogo} alt="Pick" className="w-5 h-5 object-contain invert brightness-200" />
            <span className="font-serif text-lg">Pick</span>
            <span className="text-foreground/20 text-xs font-sans">·</span>
            <span className="text-foreground/30 text-xs font-sans">Ton expert cinéma</span>
          </div>

          <div className="flex items-center gap-6 text-foreground/30 text-xs font-sans">
            <a href="#" className="hover:text-foreground/60 transition-colors">À propos</a>
            <a href="#" className="hover:text-foreground/60 transition-colors">Confidentialité</a>
            <a href="#" className="hover:text-foreground/60 transition-colors">Conditions</a>
            <a href="#" className="hover:text-foreground/60 transition-colors">Contact</a>
          </div>

          <p className="text-foreground/15 text-[10px] font-sans">
            © {new Date().getFullYear()} Pick. Tous droits réservés.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
