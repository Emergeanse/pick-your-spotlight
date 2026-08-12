import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { useNavigate, Link } from "react-router-dom";
import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Sparkles, Target, Mic, Brain, Tv, ChevronDown, Clapperboard,
  Volume2, Zap, Crown, Check,
  BookmarkPlus, Dna, Star, Eye, ArrowRight, Play, Users
} from "lucide-react";
import pickWave from "@/assets/pick-squirrel-wave.webp";
import pickDefault from "@/assets/pick-squirrel.webp";
import pickLogo from "@/assets/pick-logo.webp";
import { ALL_PLATFORMS } from "@/lib/platforms";
import TmdbAttribution from "@/components/pick/TmdbAttribution";

const POSTER_URLS = [
  // Match DEMO_MOVIES: Shawshank, Inception, Interstellar, Dark Knight
  "https://image.tmdb.org/t/p/w342/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg",
  "https://image.tmdb.org/t/p/w342/d5NXSklXo0qyIYkgV94XAgMIckC.jpg",
  "https://image.tmdb.org/t/p/w342/qJ2tW6WMUDux911BTUgMe1cEgGR.jpg",
  "https://image.tmdb.org/t/p/w342/rCzpDGLbOoPwLjy3OAm5NUPOTrC.jpg",
  "https://image.tmdb.org/t/p/w342/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg",
  "https://image.tmdb.org/t/p/w342/d5NXSklXo0qyIYkgV94XAgMIckC.jpg",
  "https://image.tmdb.org/t/p/w342/qJ2tW6WMUDux911BTUgMe1cEgGR.jpg",
  "https://image.tmdb.org/t/p/w342/rCzpDGLbOoPwLjy3OAm5NUPOTrC.jpg",
  "https://image.tmdb.org/t/p/w342/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg",
  "https://image.tmdb.org/t/p/w342/d5NXSklXo0qyIYkgV94XAgMIckC.jpg",
  "https://image.tmdb.org/t/p/w342/qJ2tW6WMUDux911BTUgMe1cEgGR.jpg",
  "https://image.tmdb.org/t/p/w342/rCzpDGLbOoPwLjy3OAm5NUPOTrC.jpg",
];



const fadeUp = {
  hidden: { opacity: 0, y: 24, filter: "blur(4px)" },
  visible: (i: number = 0) => ({
    opacity: 1, y: 0, filter: "blur(0px)",
    transition: { duration: 0.65, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  }),
};

const stagger = { visible: { transition: { staggerChildren: 0.08 } } };

const PosterColumn = ({ posters, reverse = false, className = "" }: { posters: string[]; reverse?: boolean; className?: string }) => {
  const doubled = [...posters, ...posters];
  return (
    <div className={`flex flex-col gap-2 overflow-hidden h-full ${className}`}>
      <div className={`h-full ${reverse ? "poster-scroll-reverse" : "poster-scroll"}`}>
        <div className="flex flex-col gap-2">
          {doubled.map((url, i) => (
            <img key={i} src={url} alt="" className="w-full aspect-[2/3] object-cover rounded-lg" loading="lazy" />
          ))}
        </div>
      </div>
    </div>
  );
};


const DEMO_MOVIES = [
  { poster: "https://image.tmdb.org/t/p/w500/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg", title: "The Shawshank Redemption", year: "1994", duration: "2h22", genre: "Drame", match: 94, prompt: "« Un film bouleversant pour ce soir »" },
  { poster: "https://image.tmdb.org/t/p/w500/d5NXSklXo0qyIYkgV94XAgMIckC.jpg", title: "Inception", year: "2010", duration: "2h28", genre: "Sci-Fi, Action", match: 91, prompt: "« Un truc qui retourne le cerveau »" },
  { poster: "https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911BTUgMe1cEgGR.jpg", title: "Interstellar", year: "2014", duration: "2h49", genre: "Sci-Fi, Drame", match: 89, prompt: "« Un film épique avec de l'émotion »" },
  { poster: "https://image.tmdb.org/t/p/w500/rCzpDGLbOoPwLjy3OAm5NUPOTrC.jpg", title: "The Dark Knight", year: "2008", duration: "2h32", genre: "Action, Thriller", match: 92, prompt: "« Un thriller intense et sombre »" },
];

/* ─── Simulated phone mockup showing the product ─── */
const PhoneMockup = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % DEMO_MOVIES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const movie = DEMO_MOVIES[currentIndex];

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Prompt message above phone */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4 }}
          className="px-5 py-2.5 rounded-2xl bg-card/50 border border-border/15 backdrop-blur-sm"
        >
          <p className="text-sm font-sans text-foreground/60 italic">{movie.prompt}</p>
        </motion.div>
      </AnimatePresence>

      {/* Phone */}
      <div className="relative mx-auto w-[260px] md:w-[280px]">
        <div className="rounded-[2.5rem] border-2 border-foreground/10 bg-background p-2 shadow-2xl shadow-primary/10">
          <div className="rounded-[2rem] overflow-hidden bg-card relative aspect-[9/17]">
            <div className="h-6 bg-background/80 flex items-center justify-center">
              <div className="w-16 h-1 rounded-full bg-foreground/15" />
            </div>
            <div className="p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 mb-1">
                <img src={pickDefault} alt="Pick" className="w-6 h-6 object-contain" />
                <span className="text-[10px] font-sans text-foreground/50">Pick pour ce soir</span>
              </div>
              {/* Movie poster — cycling */}
              <div className="relative rounded-xl overflow-hidden aspect-[2/3] w-full">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={movie.poster}
                    src={movie.poster}
                    alt={movie.title}
                    className="w-full h-full object-cover absolute inset-0"
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.5 }}
                  />
                </AnimatePresence>
                <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/20 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={movie.title}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/20 border border-primary/30 mb-1.5">
                        <span className="text-[9px] font-sans font-bold text-primary">{movie.match}% match</span>
                      </div>
                      <p className="text-[11px] font-serif text-foreground leading-tight">{movie.title}</p>
                      <p className="text-[8px] font-sans text-foreground/40 mt-0.5">{movie.year} · {movie.duration} · {movie.genre}</p>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 h-8 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
                  <span className="text-[9px] font-sans font-medium text-primary">On regarde</span>
                </div>
                <div className="flex-1 h-8 rounded-xl bg-card border border-border/20 flex items-center justify-center">
                  <span className="text-[9px] font-sans text-foreground/40">Autre suggestion</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dots indicator */}
      <div className="flex gap-1.5">
        {DEMO_MOVIES.map((_, i) => (
          <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${i === currentIndex ? "bg-primary" : "bg-foreground/15"}`} />
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
  const col1 = POSTER_URLS.slice(0, 4);
  const col2 = POSTER_URLS.slice(4, 8);
  const col3 = POSTER_URLS.slice(8, 12);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden relative">
      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "WebApplication",
        "name": "Pick", "description": "Ton expert cinéma personnel. Fini les 30 minutes à scroller — Pick te trouve le film parfait en secondes.",
        "url": "https://pick-your-spotlight.lovable.app", "applicationCategory": "EntertainmentApplication", "operatingSystem": "Web",
        "offers": [
          { "@type": "Offer", "price": "0", "priceCurrency": "EUR", "description": "Plan gratuit" },
          { "@type": "Offer", "price": "3.99", "priceCurrency": "EUR", "description": "Pick+ mensuel" },
          { "@type": "Offer", "price": "29.99", "priceCurrency": "EUR", "description": "Pick+ annuel" }
        ],
      })}} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "FAQPage",
        "mainEntity": [
          { "@type": "Question", "name": "Pick est-il gratuit ?", "acceptedAnswer": { "@type": "Answer", "text": "Oui, Pick est gratuit avec 3 recommandations par jour. Pick+ à 3,99€/mois offre des recommandations illimitées." }},
          { "@type": "Question", "name": "Comment Pick recommande-t-il des films ?", "acceptedAnswer": { "@type": "Answer", "text": "Pick apprend tes goûts au fil du temps et croise ton humeur, ton contexte et tes préférences pour te proposer le film parfait." }},
          { "@type": "Question", "name": "Pick fonctionne-t-il avec toutes les plateformes ?", "acceptedAnswer": { "@type": "Answer", "text": "Oui, Pick est compatible avec Netflix, Disney+, Amazon Prime, Apple TV+, Canal+, HBO, Paramount+ et plus." }}
        ]
      })}} />
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/8">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-5 h-14">
          <div className="flex items-center">
            <img src={pickLogo} alt="Pick" className="h-10 w-auto object-contain" />
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="text-foreground/50 hover:text-foreground font-sans text-sm" onClick={() => navigate("/auth")}>Connexion</Button>
            <Button size="sm" className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-sans text-sm px-5 transition-all active:scale-[0.97]" onClick={() => navigate("/app")}>Essayer Pick</Button>
          </div>
        </div>
      </nav>

      {/* ─── HERO — épuré (mobile) / split-screen (desktop) ─── */}
      <section ref={heroRef} className="relative min-h-dvh flex items-center justify-center overflow-hidden pt-14">
        {/* Poster background — mobile only (replaced by mockup on desktop) */}
        <div className="absolute inset-0 z-0 opacity-[0.12] pointer-events-none overflow-hidden md:hidden">
          <div className="flex gap-1.5 w-full h-full px-1">
            <PosterColumn posters={col1} className="w-1/4 -mt-10" />
            <PosterColumn posters={col2} reverse className="w-1/4 mt-8" />
            <PosterColumn posters={col3} className="w-1/4 -mt-20" />
            <PosterColumn posters={[...col1].reverse()} reverse className="w-1/4 mt-4" />
          </div>
        </div>
        {/* Desktop ambient glow */}
        <div className="hidden md:block absolute inset-0 z-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-primary/10 blur-[160px]" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/70 to-background md:hidden" style={{ zIndex: 1 }} />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-background md:hidden" style={{ zIndex: 1 }} />

        <motion.div style={{ opacity: heroOpacity }} className="relative z-10 w-full max-w-6xl mx-auto px-5">
          <div className="grid md:grid-cols-2 gap-10 lg:gap-16 items-center">
            {/* LEFT — Copy + CTA */}
            <div className="text-center md:text-left">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="mb-5 md:flex md:justify-start"
              >
                <img src={pickWave} alt="Pick, ton expert cinéma" className="w-20 h-20 md:w-24 md:h-24 object-contain mx-auto md:mx-0 drop-shadow-xl pick-float" />
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.25 }}
                className="text-[2.75rem] md:text-6xl lg:text-7xl font-serif leading-[0.95] mb-5"
              >
                <span className="whitespace-nowrap">Fini le scroll.</span>
                <br />
                <span className="text-primary whitespace-nowrap">Place au film.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="text-foreground/65 text-base md:text-lg font-sans font-light max-w-lg mx-auto md:mx-0 mb-8 leading-relaxed"
              >
                Pick comprend tes goûts et ton humeur pour te trouver le film parfait en quelques secondes. Plus de débat, plus d'hésitation.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.55 }}
                className="flex flex-col items-center md:items-start gap-4"
              >
                <Button
                  size="lg"
                  className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-sans font-semibold px-8 h-12 gap-2.5 text-base transition-all active:scale-[0.97] shadow-lg shadow-primary/20"
                  onClick={() => navigate("/app")}
                >
                  <Clapperboard className="w-5 h-5" />
                  Trouver mon film
                </Button>
                <div className="flex items-center gap-3">
                  {ALL_PLATFORMS.slice(0, 5).map((p) => (
                    <div key={p.id} className="w-10 h-10 rounded-xl overflow-hidden border border-border/20 bg-card/60">
                      <img src={p.logo} alt={p.label} className="w-full h-full object-cover" />
                    </div>
                  ))}
                  <span className="text-foreground/55 text-xs font-sans">+15</span>
                </div>
              </motion.div>
            </div>

            {/* RIGHT — Phone mockup (desktop only) */}
            <motion.div
              initial={{ opacity: 0, y: 40, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.9, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="hidden md:flex justify-center"
            >
              <PhoneMockup />
            </motion.div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }} className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}>
            <ChevronDown className="w-5 h-5 text-foreground/15" />
          </motion.div>
        </motion.div>
      </section>

      {/* ─── DEMO VISUELLE — mobile only (le mockup est déjà dans le hero sur desktop) ─── */}
      <section className="md:hidden py-12 px-5 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[500px] h-[500px] rounded-full bg-primary/5 blur-[140px]" />
        </div>
        <div className="max-w-5xl mx-auto relative z-10">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} className="text-center mb-10">
            <h2 className="text-3xl font-serif mb-3 leading-tight">
              Une recommandation.<br /><span className="text-primary">Pas un catalogue.</span>
            </h2>
            <p className="text-foreground/55 font-sans text-sm max-w-md mx-auto">
              Pas de listes interminables. Pick te propose LE film qui correspond à ton moment.
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 40, filter: "blur(8px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <PhoneMockup />
          </motion.div>
        </div>
      </section>

      {/* ─── COMMENT ÇA MARCHE — 3 étapes ─── */}
      <section className="pt-10 pb-4 md:pt-12 md:pb-6 px-5 relative">
        <div className="max-w-4xl mx-auto">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} className="text-center mb-6">
            <h2 className="text-3xl md:text-5xl font-serif mb-3">Simple comme <span className="text-primary">1, 2, 3</span></h2>
            <p className="text-foreground/55 font-sans text-sm md:text-base max-w-md mx-auto">De l'envie au film en quelques secondes.</p>
          </motion.div>
          <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {[
              { step: "01", icon: <Zap className="w-5 h-5" />, title: "Dis ton envie", desc: "Tape ou dis à Pick ce que tu as en tête. Une humeur, un contexte, une envie vague — il comprend tout." },
              { step: "02", icon: <Brain className="w-5 h-5" />, title: "Pick analyse", desc: "Pick croise tes goûts, ton historique et tes plateformes pour isoler le film parfait." },
              { step: "03", icon: <Play className="w-5 h-5" />, title: "Tu regardes", desc: "Un seul film, le bon. Avec le lien direct vers ta plateforme de streaming." },
            ].map((item, i) => (
              <motion.div key={item.step} variants={fadeUp} custom={i} className="text-center md:text-left">
                <div className="w-12 h-12 rounded-2xl bg-primary/8 border border-primary/15 flex items-center justify-center mb-4 mx-auto md:mx-0 text-primary">
                  {item.icon}
                </div>
                <span className="text-[10px] uppercase tracking-[0.2em] text-primary/50 font-sans font-semibold">{item.step}</span>
                <h3 className="text-lg font-serif mt-1 mb-2">{item.title}</h3>
                <p className="text-foreground/60 font-sans text-sm leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>



      {/* ─── ADN CINÉMA ─── */}
      <section className="pt-4 pb-8 md:pt-6 md:pb-10 px-5 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[500px] h-[500px] rounded-full bg-primary/4 blur-[140px]" />
        </div>
        <div className="max-w-5xl mx-auto relative z-10">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}
            className="flex flex-col items-center gap-6 md:gap-10">

            {/* Text — always on top */}
            <div className="text-center">
              <span className="text-[10px] uppercase tracking-[0.2em] text-primary/50 font-sans font-semibold">Unique</span>
              <h2 className="text-3xl md:text-4xl font-serif mb-4 mt-1">
                Ton ADN <span className="text-primary">Cinéma</span>
              </h2>
              <p className="text-foreground/60 font-sans text-sm md:text-base leading-relaxed mb-5 max-w-lg mx-auto">
                Plus tu utilises Pick, plus il te connaît. Il construit ton profil cinématographique unique :
                tes genres de prédilection, tes traits de goût, ton archétype de spectateur.
                Comme une empreinte digitale, mais pour le cinéma.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {["Archétype unique", "Évolution dans le temps", "Traits de goût", "Partageable"].map(tag => (
                  <span key={tag} className="px-3 py-1.5 rounded-full bg-card/60 border border-border/12 text-foreground/40 text-xs font-sans">{tag}</span>
                ))}
              </div>
            </div>

            {/* DNA Visual — below text */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
              className="w-full max-w-[300px]"
            >
              <div className="rounded-3xl border border-border/15 bg-card/30 p-5 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center">
                    <Dna className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-[11px] font-sans text-foreground/40">Ton archétype</p>
                    <p className="text-sm font-serif text-foreground">L'Explorateur Nocturne</p>
                  </div>
                </div>
                <div className="space-y-2.5 mb-4">
                  {[
                    { genre: "Thriller", pct: 85, color: "bg-primary" },
                    { genre: "Drame", pct: 72, color: "bg-primary/70" },
                    { genre: "Sci-Fi", pct: 58, color: "bg-primary/50" },
                    { genre: "Comédie", pct: 34, color: "bg-primary/30" },
                  ].map((g) => (
                    <div key={g.genre}>
                      <div className="flex justify-between mb-0.5">
                        <span className="text-[10px] font-sans text-foreground/50">{g.genre}</span>
                        <span className="text-[10px] font-sans text-foreground/45">{g.pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-foreground/5 overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${g.color}`}
                          initial={{ width: 0 }}
                          whileInView={{ width: `${g.pct}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {["Suspense psychologique", "Twists narratifs", "Ambiances sombres", "Anti-héros"].map((trait) => (
                    <span key={trait} className="px-2 py-1 rounded-md bg-primary/8 border border-primary/12 text-[9px] font-sans text-foreground/50">{trait}</span>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ─── PICK TOGETHER ─── */}
      <section className="py-12 md:py-16 px-5 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[500px] h-[400px] rounded-full bg-gold/4 blur-[130px]" />
        </div>
        <div className="max-w-5xl mx-auto relative z-10">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}
            className="flex flex-col md:flex-row items-center gap-10 md:gap-16">

            {/* Text */}
            <div className="text-center md:text-left">
              <span className="text-[10px] uppercase tracking-[0.2em] text-gold/50 font-sans font-semibold">À plusieurs</span>
              <h2 className="text-3xl md:text-4xl font-serif mb-4 mt-1">
                Pick <span className="text-gold">Ensemble</span>
              </h2>
              <p className="text-foreground/60 font-sans text-sm md:text-base leading-relaxed mb-5">
                Fini les 30 minutes de débat. Pick croise vos profils cinématographiques
                et trouve instantanément le film qui plaît à tout le monde.
                Chacun a ses goûts — Pick trouve le terrain d'entente parfait.
              </p>
              <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                {["Croisement des profils", "Score de compatibilité", "QR code d'invitation", "Jusqu'à 8 personnes"].map(tag => (
                  <span key={tag} className="px-3 py-1.5 rounded-full bg-card/60 border border-border/12 text-foreground/40 text-xs font-sans">{tag}</span>
                ))}
              </div>
            </div>

            {/* Visual — crossing profiles */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
              className="flex-shrink-0 w-full md:w-auto"
            >
              <div className="mx-auto w-[280px] md:w-[300px]">
                {/* Two profiles merging */}
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="w-14 h-14 rounded-full bg-primary/12 border-2 border-primary/25 flex items-center justify-center">
                    <span className="text-primary font-sans font-bold text-sm">Alex</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-8 h-px bg-primary/30" />
                    <Users className="w-4 h-4 text-primary/50" />
                    <div className="w-8 h-px bg-gold/30" />
                  </div>
                  <div className="w-14 h-14 rounded-full bg-gold/12 border-2 border-gold/25 flex items-center justify-center">
                    <span className="text-gold font-sans font-bold text-sm">Marie</span>
                  </div>
                </div>

                {/* Result card */}
                <div className="rounded-2xl border border-border/15 bg-card/30 p-4 backdrop-blur-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-16 rounded-lg overflow-hidden flex-shrink-0">
                      <img src="https://image.tmdb.org/t/p/w342/d5NXSklXo0qyIYkgV94XAgMIckC.jpg" alt="Film" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <p className="text-[11px] font-serif text-foreground leading-tight">Inception</p>
                      <p className="text-[9px] font-sans text-foreground/50 mt-0.5">2h28 · Sci-Fi, Action</p>
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold/15 border border-gold/25 mt-1.5">
                        <span className="text-[9px] font-sans font-bold text-gold">91% compatibilité</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center"><span className="text-[7px] text-primary font-bold">Alex</span></div>
                      <span className="text-[9px] font-sans text-foreground/40">Adore les twists et le suspense</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-gold/15 flex items-center justify-center"><span className="text-[7px] text-gold font-bold">Marie</span></div>
                      <span className="text-[9px] font-sans text-foreground/40">Fan de Leonardo DiCaprio</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ─── PLATEFORMES ─── */}
      <section className="py-10 md:py-14 px-5 relative">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}>
            <h2 className="text-3xl md:text-5xl font-serif mb-3">Compatible avec <span className="text-primary">tes abonnements</span></h2>
            <p className="text-foreground/55 font-sans text-sm md:text-base max-w-lg mx-auto mb-8">Pick ne recommande que des films disponibles sur tes plateformes.</p>
          </motion.div>
          <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} className="flex items-center justify-center gap-4 md:gap-6 flex-wrap">
            {ALL_PLATFORMS.map((p, i) => (
              <motion.div key={p.id} variants={fadeUp} custom={i} className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 md:w-18 md:h-18 rounded-2xl overflow-hidden border border-border/12 hover:border-gold/25 transition-all duration-300 hover:scale-105 shadow-lg">
                  <img src={p.logo} alt={p.label} className="w-full h-full object-cover" />
                </div>
                <span className="text-[10px] font-sans text-foreground/45">{p.label}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section className="py-10 md:py-14 px-5 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[500px] h-[400px] rounded-full bg-gold/4 blur-[120px]" />
        </div>
        <div className="max-w-4xl mx-auto relative z-10">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} className="text-center mb-8">
            <h2 className="text-3xl md:text-5xl font-serif mb-3">Commence <span className="text-primary">gratuitement</span></h2>
            <p className="text-foreground/55 font-sans text-sm md:text-base max-w-lg mx-auto">Pick est gratuit pour toujours. Pick+ amplifie l'expérience.</p>
          </motion.div>
          <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} className="grid md:grid-cols-2 gap-5 max-w-2xl mx-auto">
            {/* Free */}
            <motion.div variants={fadeUp} custom={0} className="rounded-2xl border border-border/12 bg-card/30 p-6 md:p-8">
              <h3 className="text-xl font-serif mb-1">Gratuit</h3>
              <p className="text-foreground/50 text-sm font-sans mb-1">Pour toujours</p>
              <p className="text-3xl font-serif text-foreground mb-5">0€</p>
              <div className="space-y-3">
                {["3 recommandations / jour", "Parle à Pick (1/jour)", "ADN Cinéma de base", "Watchlist & films aimés", "Liens plateformes", "Mode Compagnon (1 question/film)"].map((f) => (
                  <div key={f} className="flex items-center gap-2.5"><Check className="w-4 h-4 text-primary/50 shrink-0" /><span className="text-foreground/50 text-sm font-sans">{f}</span></div>
                ))}
              </div>
            </motion.div>
            {/* Pick+ */}
            <motion.div variants={fadeUp} custom={1} className="rounded-2xl border-2 border-gold/25 bg-gradient-to-br from-card/50 to-gold/[0.02] p-6 md:p-8 relative overflow-hidden">
              <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gold/12 border border-gold/20">
                <Crown className="w-3 h-3 text-gold" /><span className="text-gold text-[10px] font-sans font-bold uppercase tracking-wider">Populaire</span>
              </div>
              <h3 className="text-xl font-serif mb-1 text-gold">Pick+</h3>
              <p className="text-foreground/50 text-sm font-sans mb-1">L'expérience complète</p>
              <div className="flex items-baseline gap-1 mb-5"><p className="text-3xl font-serif text-foreground">3,99€</p><span className="text-foreground/50 text-sm font-sans">/mois</span></div>
              <div className="space-y-3">
                {["Tout le plan Gratuit", "Recommandations illimitées", "Chatbot complet", "Mode Compagnon illimité", "ADN Cinéma avancé", "Pick Ensemble", "Profils multiples"].map((f) => (
                  <div key={f} className="flex items-center gap-2.5"><Check className="w-4 h-4 text-gold shrink-0" /><span className="text-foreground/60 text-sm font-sans">{f}</span></div>
                ))}
              </div>
              <div className="mt-6 space-y-2">
                <Button className="w-full rounded-full bg-gold text-gold-foreground hover:bg-gold/90 font-sans font-semibold h-11 text-sm gap-2 gold-glow" disabled>
                  <Crown className="w-4 h-4" />Annuel — 29,99€/an
                </Button>
                <Button variant="outline" className="w-full rounded-full border-gold/15 text-foreground/40 font-sans text-sm h-10" disabled>Mensuel — 3,99€/mois</Button>
                <p className="text-center text-foreground/40 text-[10px] font-sans">Bientôt disponible</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>


      {/* ─── FOOTER ─── */}
      <footer className="border-t border-border/8 py-10 px-5">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center">
            <img src={pickLogo} alt="Pick" className="h-9 w-auto object-contain" />
          </div>
          <div className="flex items-center gap-6 text-foreground/45 text-xs font-sans">
            <Link to="/trust" className="hover:text-foreground/70 transition-colors">Confiance</Link>
            <Link to="/confidentialite" className="hover:text-foreground/70 transition-colors">Confidentialité</Link>
            <Link to="/conditions" className="hover:text-foreground/70 transition-colors">Conditions</Link>
          </div>
          <p className="text-foreground/12 text-[10px] font-sans">© {new Date().getFullYear()} Pick. Tous droits réservés.</p>
        </div>
        <div className="max-w-5xl mx-auto mt-8 pt-6 border-t border-border/5">
          <TmdbAttribution />
        </div>
      </footer>
    </div>
  );
};

export default Landing;
