import { motion, useScroll, useTransform } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Target, Dice5, Mic, Brain, Tv, ArrowRight, ChevronDown } from "lucide-react";

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
  { name: "Disney+", logo: "https://image.tmdb.org/t/p/original/7rwgEs15tFwyR9NPQ5vpzxTj19Q.jpg" },
  { name: "Amazon Prime", logo: "https://image.tmdb.org/t/p/original/dQeAar5H991VYporEjUspolDarG.jpg" },
  { name: "Apple TV+", logo: "https://image.tmdb.org/t/p/original/6uhKBfmtzFqOcLousHwZuzcrScK.jpg" },
  { name: "Canal+", logo: "https://image.tmdb.org/t/p/original/dVMVBMOlOUPFfbkSKNnTGg3JX5b.jpg" },
  { name: "Paramount+", logo: "https://image.tmdb.org/t/p/original/fi83B1ozBIOCEo7cWoevSYS0tXi.jpg" },
  { name: "Max", logo: "https://image.tmdb.org/t/p/original/6Q3YKUNA60A4DxOrPaUTDOE4BrU.jpg" },
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
          <span className="font-serif text-xl tracking-wide">Pick</span>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="text-foreground/60 hover:text-foreground font-sans text-sm"
              onClick={() => navigate("/auth")}
            >
              Sign in
            </Button>
            <Button
              size="sm"
              className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-sans text-sm px-4 neon-glow"
              onClick={() => navigate("/auth")}
            >
              Get started
            </Button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Poster grid background */}
        <motion.div style={{ scale: heroScale }} className="absolute inset-0">
          <div className="absolute inset-0 grid grid-cols-4 md:grid-cols-6 gap-1 opacity-[0.12]">
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
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-6"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-primary text-xs font-sans font-medium">AI-powered recommendations</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="text-4xl md:text-6xl lg:text-7xl font-serif leading-[1.05] mb-5"
          >
            Never waste time choosing what to watch{" "}
            <span className="text-primary italic">again.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="text-foreground/50 text-base md:text-lg font-sans font-light max-w-xl mx-auto mb-8 leading-relaxed"
          >
            Pick learns your taste and finds the perfect movie or series for you tonight.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            className="flex items-center justify-center gap-3 flex-wrap"
          >
            <Button
              size="lg"
              className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-sans font-semibold px-7 h-12 gap-2.5 text-base neon-glow transition-all active:scale-[0.97]"
              onClick={() => navigate("/auth")}
            >
              Find something to watch
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="rounded-full text-foreground/60 hover:text-foreground font-sans font-medium px-6 h-12 gap-2 text-base border border-border/20 hover:border-border/40 transition-all"
              onClick={() => navigate("/auth")}
            >
              <Dice5 className="w-4 h-4" />
              Surprise me
            </Button>
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
              Find the perfect movie in seconds
            </h2>
            <p className="text-foreground/40 font-sans text-sm md:text-base max-w-md mx-auto">
              Three steps. One perfect recommendation.
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
                step: "01",
                title: "Tell Pick how you feel",
                desc: "Your mood, available time, and who you're watching with.",
                icon: "🎭",
              },
              {
                step: "02",
                title: "Pick learns what you love",
                desc: "Choose movies you like and Pick builds your taste profile.",
                icon: "🧠",
              },
              {
                step: "03",
                title: "Get the perfect match",
                desc: "One movie, perfectly matched for tonight. Not a list — the one.",
                icon: "🎬",
              },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                variants={fadeUp}
                custom={i}
                className="relative group bg-card/50 border border-border/15 rounded-2xl p-6 md:p-8 hover:border-primary/20 transition-all duration-300"
              >
                <div className="absolute top-6 right-6 text-[10px] font-sans font-semibold text-foreground/15 tracking-widest">
                  {item.step}
                </div>
                <div className="text-3xl mb-4">{item.icon}</div>
                <h3 className="text-lg md:text-xl font-serif mb-2">{item.title}</h3>
                <p className="text-foreground/40 text-sm font-sans leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── PERSONALIZATION ── */}
      <section className="py-24 md:py-32 px-5 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[500px] h-[500px] rounded-full bg-primary/3 blur-[100px]" />
        </div>

        <div className="max-w-5xl mx-auto relative z-10">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-serif mb-3">
              Recommendations that actually{" "}
              <span className="text-primary italic">understand</span> your taste
            </h2>
          </motion.div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto"
          >
            {[
              { text: "Learns from the movies you love", tag: "Taste Profile" },
              { text: "Remembers what you skip and what you save", tag: "Behavior" },
              { text: "Adapts to your mood and context", tag: "Session" },
              { text: "Gets smarter with every interaction", tag: "AI Learning" },
            ].map((item, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                custom={i}
                className="flex items-start gap-4 p-5 rounded-xl bg-card/30 border border-border/10"
              >
                <div className="mt-0.5 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-primary/60 font-sans font-semibold">
                    {item.tag}
                  </span>
                  <p className="text-foreground/70 font-sans text-sm mt-1">{item.text}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Floating taste tags */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="flex flex-wrap justify-center gap-2 mt-12"
          >
            {["Thriller", "Feel Good", "Dark", "Mind Blowing", "Cozy", "Slow Burn", "Visually Stunning", "Twist Ending"].map((tag, i) => (
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

      {/* ── SMART FEATURES ── */}
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
              More than just a movie search
            </h2>
            <p className="text-foreground/40 font-sans text-sm md:text-base max-w-md mx-auto">
              Pick is your intelligent cinema companion.
            </p>
          </motion.div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {[
              {
                icon: <Target className="w-5 h-5" />,
                title: "Smart recommendations",
                desc: "Analyzes your taste and context to suggest the best movie.",
              },
              {
                icon: <Dice5 className="w-5 h-5" />,
                title: "Surprise mode",
                desc: "Let Pick choose the perfect movie for tonight.",
              },
              {
                icon: <Mic className="w-5 h-5" />,
                title: "Talk to Pick",
                desc: "Ask for a movie in natural language.",
              },
              {
                icon: <Brain className="w-5 h-5" />,
                title: "Learns over time",
                desc: "The more you use Pick, the better it gets.",
              },
            ].map((f, i) => (
              <motion.div
                key={f.title}
                variants={fadeUp}
                custom={i}
                className="group bg-card/40 border border-border/15 rounded-2xl p-6 hover:border-primary/20 transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:bg-primary/15 transition-colors">
                  {f.icon}
                </div>
                <h3 className="text-base font-serif mb-1.5">{f.title}</h3>
                <p className="text-foreground/40 text-sm font-sans leading-relaxed">{f.desc}</p>
              </motion.div>
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
              Across all streaming platforms
            </h2>
            <p className="text-foreground/40 font-sans text-sm md:text-base max-w-lg mx-auto mb-12">
              Discover movies available on your streaming services so you always know where to watch.
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
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-serif mb-4">
            Ready to find your next movie?
          </h2>
          <p className="text-foreground/40 font-sans text-sm md:text-base max-w-md mx-auto mb-8">
            Stop scrolling. Start watching.
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Button
              size="lg"
              className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-sans font-semibold px-7 h-12 gap-2.5 text-base neon-glow transition-all active:scale-[0.97]"
              onClick={() => navigate("/auth")}
            >
              Start discovering
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="rounded-full text-foreground/60 hover:text-foreground font-sans font-medium px-6 h-12 gap-2 text-base border border-border/20 hover:border-border/40 transition-all"
              onClick={() => navigate("/app?mode=surprise")}
            >
              <Dice5 className="w-4 h-4" />
              Try surprise mode
            </Button>
          </div>
        </motion.div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-border/10 py-10 px-5">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span className="font-serif text-lg">Pick</span>
            <span className="text-foreground/20 text-xs font-sans">·</span>
            <span className="text-foreground/30 text-xs font-sans">Your movie companion</span>
          </div>

          <div className="flex items-center gap-6 text-foreground/30 text-xs font-sans">
            <a href="#" className="hover:text-foreground/60 transition-colors">About</a>
            <a href="#" className="hover:text-foreground/60 transition-colors">Privacy</a>
            <a href="#" className="hover:text-foreground/60 transition-colors">Terms</a>
            <a href="#" className="hover:text-foreground/60 transition-colors">Contact</a>
          </div>

          <p className="text-foreground/15 text-[10px] font-sans">
            © {new Date().getFullYear()} Pick. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
