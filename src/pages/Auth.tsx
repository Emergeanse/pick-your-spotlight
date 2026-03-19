import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
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
      </motion.div>
    </div>
  );
};

export default Auth;
