import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Mail, Lock, User, ArrowLeft, Loader2, Eye, EyeOff } from "lucide-react";
import { useNavigate, Navigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import pickLogo from "@/assets/pick-logo.png";

type AuthMode = "login" | "signup" | "forgot" | "reset";

const Auth = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [name, setName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteCode = searchParams.get("invite");
  const redirectTo = searchParams.get("redirect");
  const eventToken = searchParams.get("event_token");   // lien invitation soirée
  const skipOnboarding = searchParams.get("skip_onboarding") === "true";

  const { user, isReady } = useAuth();

  // Écoute l'événement PASSWORD_RECOVERY de Supabase (lien email cliqué)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("reset");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Auto-process invite after login
  useEffect(() => {
    if (isReady && user && inviteCode) {
      processInvite(user.id, inviteCode);
    }
  }, [isReady, user, inviteCode]);

  if (isReady && user && !inviteCode && mode !== "reset") {
    const dest = eventToken
      ? `/invite/${eventToken}?joined=1`
      : redirectTo || "/app";
    return <Navigate to={dest} replace />;
  }

  const processInvite = async (userId: string, code: string) => {
    try {
      const { data: rpc } = await (supabase as any).rpc("find_profile_by_friend_code", { _code: code.toUpperCase() });
      const found = Array.isArray(rpc) && rpc.length > 0 ? rpc[0] : null;
      if (!found || found.id === userId) return;
      const { data: existing } = await (supabase.from("friendships" as any).select("id") as any)
        .or(`and(requester_id.eq.${userId},addressee_id.eq.${found.id}),and(requester_id.eq.${found.id},addressee_id.eq.${userId})`);
      if (existing && (existing as any[]).length > 0) return;
      await supabase.from("friendships" as any).insert({ requester_id: userId, addressee_id: found.id, status: "accepted" } as any);
      toast.success("Ami ajouté automatiquement !");
    } catch (e) { console.error("Invite processing failed", e); }
  };

  const isFormValid = mode === "login"
    ? email.trim().length > 0 && password.length >= 6
    : mode === "signup"
      ? email.trim().length > 0 && password.length >= 6 && name.trim().length > 0
      : mode === "forgot"
        ? email.trim().length > 0
        : newPassword.length >= 6;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (inviteCode && data.user) await processInvite(data.user.id, inviteCode);
        toast.success("Connecté !");
        navigate(redirectTo || "/app");

      } else if (mode === "signup") {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: name,
              birth_year: birthYear ? parseInt(birthYear) : undefined,
              onboarding_skipped: skipOnboarding,
            },
            emailRedirectTo: inviteCode
              ? `${window.location.origin}/auth?invite=${inviteCode}`
              : eventToken
                ? `${window.location.origin}/invite/${eventToken}?joined=1`
                : window.location.origin,
          },
        });
        if (error) throw error;
        // Marque le compte comme light/skipped en DB si applicable
        if (skipOnboarding && signUpData.user) {
          await supabase.from("profiles").update({
            onboarding_skipped: true,
            account_type: "light",
          } as any).eq("id", signUpData.user.id);
        }
        toast.success("Vérifie ta boîte mail pour confirmer ton compte !");

      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (error) throw error;
        setForgotSent(true);

      } else if (mode === "reset") {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        toast.success("Mot de passe mis à jour !");
        navigate("/app");
      }
    } catch (err: any) {
      toast.error(err.message || "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center p-5">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm relative"
      >
        {/* Bouton retour */}
        <button
          onClick={() => {
            if (mode === "forgot" || mode === "reset") { setMode("login"); setForgotSent(false); }
            else navigate("/");
          }}
          className="flex items-center gap-2 text-foreground/50 hover:text-foreground text-sm font-sans mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {mode === "forgot" || mode === "reset" ? "Retour à la connexion" : "Retour"}
        </button>

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img src={pickLogo} alt="Pick" className="h-14 w-auto object-contain" />
        </div>

        {/* ── Mode RESET (nouveau mot de passe) ── */}
        <AnimatePresence mode="wait">
          {mode === "reset" && (
            <motion.div key="reset" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <h1 className="text-3xl font-serif mb-2">Nouveau mot de passe</h1>
              <p className="text-foreground/50 text-sm font-sans mb-8">Choisis un nouveau mot de passe pour ton compte.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showNewPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Nouveau mot de passe (6 caractères min.)"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full bg-card border border-border/30 rounded-xl px-10 py-3 text-sm font-sans text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <Button
                  type="submit"
                  variant="hero"
                  size="xl"
                  className={`w-full text-sm transition-all ${!isFormValid && !loading ? "opacity-50" : "opacity-100"}`}
                  disabled={loading || !isFormValid}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enregistrer le mot de passe"}
                </Button>
              </form>
            </motion.div>
          )}

          {/* ── Mode FORGOT ── */}
          {mode === "forgot" && (
            <motion.div key="forgot" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <h1 className="text-3xl font-serif mb-2">Mot de passe oublié</h1>
              <p className="text-foreground/50 text-sm font-sans mb-8">
                Saisis ton adresse email et on t'envoie un lien pour réinitialiser ton mot de passe.
              </p>

              {forgotSent ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-3 py-8 text-center"
                >
                  <span className="text-4xl">📬</span>
                  <p className="text-foreground font-serif text-xl">Email envoyé !</p>
                  <p className="text-foreground/50 text-sm font-sans">
                    Vérifie ta boîte mail ({email}) et clique sur le lien pour choisir un nouveau mot de passe.
                  </p>
                  <p className="text-foreground/50 text-xs font-sans mt-1">
                    Le lien expire dans 24 h. Pense à vérifier les spams.
                  </p>
                  <button
                    onClick={() => { setMode("login"); setForgotSent(false); setEmail(""); }}
                    className="mt-4 text-primary text-sm font-sans hover:underline"
                  >
                    Retour à la connexion
                  </button>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="Ton adresse email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      className="w-full bg-card border border-border/30 rounded-xl px-10 py-3 text-sm font-sans text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 transition-colors"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="hero"
                    size="xl"
                    className={`w-full text-sm transition-all ${!isFormValid && !loading ? "opacity-50" : "opacity-100"}`}
                    disabled={loading || !isFormValid}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Envoyer le lien"}
                  </Button>
                </form>
              )}
            </motion.div>
          )}

          {/* ── Modes LOGIN / SIGNUP ── */}
          {(mode === "login" || mode === "signup") && (
            <motion.div key="login-signup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* Tabs */}
              <div className="flex gap-1 bg-card rounded-xl p-1 mb-8">
                <button
                  onClick={() => setMode("login")}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-sans font-medium transition-all ${
                    mode === "login" ? "bg-primary/10 text-primary" : "text-foreground/40 hover:text-foreground"
                  }`}
                >
                  Connexion
                </button>
                <button
                  onClick={() => setMode("signup")}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-sans font-medium transition-all ${
                    mode === "signup" ? "bg-primary/10 text-primary" : "text-foreground/40 hover:text-foreground"
                  }`}
                >
                  Inscription
                </button>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={mode}
                  initial={{ opacity: 0, x: mode === "login" ? -20 : 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: mode === "login" ? 20 : -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <h1 className="text-3xl font-serif mb-2">
                    {mode === "login" ? "Bon retour" : "Crée ton compte"}
                  </h1>
                  <p className="text-foreground/50 text-sm font-sans mb-8">
                    {mode === "login"
                      ? "Connecte-toi pour retrouver tes recommandations"
                      : "Rejoins-nous pour des suggestions personnalisées"}
                  </p>
                </motion.div>
              </AnimatePresence>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Champs inscription uniquement */}
                <AnimatePresence>
                  {mode === "signup" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="relative pb-4">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Ton prénom"
                          value={name}
                          onChange={e => setName(e.target.value)}
                          autoComplete="given-name"
                          className="w-full bg-card border border-border/30 rounded-xl px-10 py-3 text-sm font-sans text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 transition-colors"
                        />
                      </div>
                      <div className="relative pb-4">
                        <select
                          value={birthYear}
                          onChange={e => setBirthYear(e.target.value)}
                          className="w-full bg-card border border-border/30 rounded-xl px-4 py-3 text-sm font-sans text-foreground outline-none focus:border-primary/50 transition-colors appearance-none"
                        >
                          <option value="" className="text-muted-foreground">Quelle est ton année de naissance ?</option>
                          {Array.from({ length: 80 }, (_, i) => new Date().getFullYear() - 5 - i).map(y => (
                            <option key={y} value={y}>{y} ({new Date().getFullYear() - y} ans)</option>
                          ))}
                        </select>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Email */}
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="Email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="w-full bg-card border border-border/30 rounded-xl px-10 py-3 text-sm font-sans text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 transition-colors"
                  />
                </div>

                {/* Mot de passe */}
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="password"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    placeholder="Mot de passe"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full bg-card border border-border/30 rounded-xl px-10 py-3 text-sm font-sans text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 transition-colors"
                  />
                </div>

                {/* Lien "Mot de passe oublié ?" — visible uniquement en mode login */}
                {mode === "login" && (
                  <div className="text-right -mt-1">
                    <button
                      type="button"
                      onClick={() => { setMode("forgot"); setForgotSent(false); }}
                      className="text-xs text-foreground/40 hover:text-primary font-sans transition-colors"
                    >
                      Mot de passe oublié ?
                    </button>
                  </div>
                )}

                <Button
                  type="submit"
                  variant="hero"
                  size="xl"
                  className={`w-full text-sm transition-all ${!isFormValid && !loading ? "opacity-50" : "opacity-100"}`}
                  disabled={loading || !isFormValid}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : mode === "login" ? (
                    "Se connecter"
                  ) : (
                    "Créer mon compte"
                  )}
                </Button>
              </form>

              {/* Divider */}
              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-border/30" />
                <span className="text-foreground/45 text-xs font-sans">ou</span>
                <div className="flex-1 h-px bg-border/30" />
              </div>

              {/* Social login */}
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  disabled={!!socialLoading}
                  onClick={async () => {
                    setSocialLoading("google");
                    const { error } = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
                    if (error) { toast.error("Erreur de connexion Google"); setSocialLoading(null); }
                  }}
                  className="w-full flex items-center justify-center gap-3 bg-card border border-border/30 rounded-xl py-3 text-sm font-sans font-medium text-foreground hover:border-primary/30 transition-all disabled:opacity-50"
                >
                  {socialLoading === "google" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                  )}
                  Continuer avec Google
                </button>

                <button
                  type="button"
                  disabled={!!socialLoading}
                  onClick={async () => {
                    setSocialLoading("apple");
                    const { error } = await lovable.auth.signInWithOAuth("apple", { redirect_uri: window.location.origin });
                    if (error) { toast.error("Erreur de connexion Apple"); setSocialLoading(null); }
                  }}
                  className="w-full flex items-center justify-center gap-3 bg-card border border-border/30 rounded-xl py-3 text-sm font-sans font-medium text-foreground hover:border-primary/30 transition-all disabled:opacity-50"
                >
                  {socialLoading === "apple" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                    </svg>
                  )}
                  Continuer avec Apple
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default Auth;
