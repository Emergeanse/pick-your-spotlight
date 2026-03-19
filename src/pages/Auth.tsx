import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Mail, Lock, User, ArrowLeft, Loader2 } from "lucide-react";
import { useNavigate, Navigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteCode = searchParams.get("invite");
  const redirectTo = searchParams.get("redirect");

  const { user, isReady } = useAuth();

  // Auto-process invite after login
  useEffect(() => {
    if (isReady && user && inviteCode) {
      processInvite(user.id, inviteCode);
    }
  }, [isReady, user, inviteCode]);

  if (isReady && user && !inviteCode) {
    return <Navigate to={redirectTo || "/app"} replace />;
  }

  const processInvite = async (userId: string, code: string) => {
    try {
      const { data: found } = await (supabase.from("profiles").select("id") as any).eq("friend_code", code.toUpperCase()).single();
      if (!found || found.id === userId) return;
      const { data: existing } = await (supabase.from("friendships" as any).select("id") as any)
        .or(`and(requester_id.eq.${userId},addressee_id.eq.${found.id}),and(requester_id.eq.${found.id},addressee_id.eq.${userId})`);
      if (existing && (existing as any[]).length > 0) return;
      await supabase.from("friendships" as any).insert({ requester_id: userId, addressee_id: found.id, status: "accepted" } as any);
      toast.success("Ami ajouté automatiquement !");
    } catch (e) { console.error("Invite processing failed", e); }
  };

  const isFormValid = isLogin
    ? email.trim().length > 0 && password.length >= 6
    : email.trim().length > 0 && password.length >= 6 && name.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (inviteCode && data.user) await processInvite(data.user.id, inviteCode);
        toast.success("Connecté !");
        navigate(redirectTo || "/app");
      } else {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: name, birth_year: birthYear ? parseInt(birthYear) : undefined },
            emailRedirectTo: inviteCode ? `${window.location.origin}/auth?invite=${inviteCode}` : window.location.origin,
          },
        });
        if (error) throw error;
        toast.success("Vérifie ta boîte mail pour confirmer ton compte !");
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
        className="w-full max-w-sm"
      >
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-foreground/50 hover:text-foreground text-sm font-sans mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>

        {/* Tabs login/signup */}
        <div className="flex gap-1 bg-card rounded-xl p-1 mb-8">
          <button
            onClick={() => setIsLogin(true)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-sans font-medium transition-all ${
              isLogin ? "bg-primary/10 text-primary" : "text-foreground/40 hover:text-foreground"
            }`}
          >
            Connexion
          </button>
          <button
            onClick={() => setIsLogin(false)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-sans font-medium transition-all ${
              !isLogin ? "bg-primary/10 text-primary" : "text-foreground/40 hover:text-foreground"
            }`}
          >
            Inscription
          </button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={isLogin ? "login" : "signup"}
            initial={{ opacity: 0, x: isLogin ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isLogin ? 20 : -20 }}
            transition={{ duration: 0.2 }}
          >
            <h1 className="text-3xl font-serif mb-2">
              {isLogin ? "Bon retour" : "Crée ton compte"}
            </h1>
            <p className="text-foreground/50 text-sm font-sans mb-8">
              {isLogin
                ? "Connecte-toi pour retrouver tes recommandations"
                : "Rejoins-nous pour des suggestions personnalisées"}
            </p>
          </motion.div>
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence>
            {!isLogin && (
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
                    <option value="" className="text-muted-foreground">Ton année de naissance</option>
                    {Array.from({ length: 80 }, (_, i) => new Date().getFullYear() - 5 - i).map(y => (
                      <option key={y} value={y}>{y} ({new Date().getFullYear() - y} ans)</option>
                    ))}
                  </select>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

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

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              placeholder="Mot de passe"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-card border border-border/30 rounded-xl px-10 py-3 text-sm font-sans text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 transition-colors"
            />
          </div>

          <Button
            type="submit"
            variant="hero"
            size="xl"
            className={`w-full text-sm transition-all ${
              !isFormValid && !loading ? "opacity-50" : "opacity-100"
            }`}
            disabled={loading || !isFormValid}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isLogin ? (
              "Se connecter"
            ) : (
              "Créer mon compte"
            )}
          </Button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-border/30" />
          <span className="text-foreground/30 text-xs font-sans">ou</span>
          <div className="flex-1 h-px bg-border/30" />
        </div>

        {/* Social login buttons */}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            disabled={!!socialLoading}
            onClick={async () => {
              setSocialLoading("google");
              const { error } = await lovable.auth.signInWithOAuth("google", {
                redirect_uri: window.location.origin,
              });
              if (error) {
                toast.error("Erreur de connexion Google");
                setSocialLoading(null);
              }
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
              const { error } = await lovable.auth.signInWithOAuth("apple", {
                redirect_uri: window.location.origin,
              });
              if (error) {
                toast.error("Erreur de connexion Apple");
                setSocialLoading(null);
              }
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
    </div>
  );
};

export default Auth;
