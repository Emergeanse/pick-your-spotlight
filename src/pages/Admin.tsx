import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, UserPlus, Loader2, Shield, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { useAdmin } from "@/hooks/use-admin";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Admin = () => {
  const navigate = useNavigate();
  const { user, isReady } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [displayName, setDisplayName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdAccount, setCreatedAccount] = useState<{ email: string; password: string; name: string } | null>(null);

  if (!isReady || adminLoading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center p-5">
        <div className="text-center">
          <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-xl font-serif mb-2">Accès refusé</h1>
          <p className="text-sm text-muted-foreground mb-6">Cette page est réservée aux administrateurs.</p>
          <Button variant="hero" onClick={() => navigate("/app")}>Retour</Button>
        </div>
      </div>
    );
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: {
          displayName: displayName || undefined,
          birthYear: birthYear ? parseInt(birthYear) : undefined,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      setCreatedAccount({ email: data.email, password: data.password, name: data.displayName });
      toast.success(`Compte test "${data.displayName}" créé !`);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la création");
    } finally {
      setCreating(false);
    }
  };

  const handleLoginAsTestUser = async () => {
    if (!createdAccount) return;

    // Sign out current admin, then sign in as test user
    await supabase.auth.signOut();
    const { error } = await supabase.auth.signInWithPassword({
      email: createdAccount.email,
      password: createdAccount.password,
    });

    if (error) {
      toast.error("Connexion échouée : " + error.message);
      return;
    }

    toast.success(`Connecté en tant que ${createdAccount.name}`);
    navigate("/app");
  };

  const currentYear = new Date().getFullYear();

  return (
    <div className="fixed inset-0 bg-background overflow-y-auto">
      <div className="max-w-md mx-auto p-5 pb-20">
        <button
          onClick={() => navigate("/app")}
          className="flex items-center gap-2 text-foreground/50 hover:text-foreground text-sm font-sans mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-serif">Administration</h1>
              <p className="text-xs text-muted-foreground">Comptes éphémères — supprimés à la déconnexion</p>
            </div>
          </div>

          {!createdAccount ? (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground font-sans mb-1 block">Prénom du profil test</label>
                <Input
                  type="text"
                  placeholder="ex: Marie, 14 ans"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  className="bg-card border-border/30"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-sans mb-1 block">Année de naissance</label>
                <select
                  value={birthYear}
                  onChange={e => setBirthYear(e.target.value)}
                  className="w-full bg-card border border-border/30 rounded-xl px-4 py-3 text-sm font-sans text-foreground outline-none focus:border-primary/50 transition-colors appearance-none"
                >
                  <option value="">Non spécifié</option>
                  {Array.from({ length: 80 }, (_, i) => currentYear - 5 - i).map(y => (
                    <option key={y} value={y}>{y} ({currentYear - y} ans)</option>
                  ))}
                </select>
              </div>

              <Button
                type="submit"
                variant="hero"
                size="xl"
                className="w-full"
                disabled={creating}
              >
                {creating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Créer un profil test
                  </>
                )}
              </Button>
            </form>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4"
            >
              <div className="bg-card rounded-2xl p-5 border border-border/30 text-center">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <UserPlus className="w-7 h-7 text-primary" />
                </div>
                <h2 className="text-lg font-serif mb-1">{createdAccount.name}</h2>
                <p className="text-xs text-muted-foreground mb-4">
                  Compte éphémère prêt. Il sera supprimé à la déconnexion.
                </p>

                <Button
                  variant="hero"
                  size="xl"
                  className="w-full"
                  onClick={handleLoginAsTestUser}
                >
                  <LogIn className="w-4 h-4" />
                  Se connecter en tant que {createdAccount.name}
                </Button>
              </div>

              <Button
                variant="ghost"
                className="w-full text-muted-foreground text-xs"
                onClick={() => {
                  setCreatedAccount(null);
                  setDisplayName("");
                  setBirthYear("");
                }}
              >
                Créer un autre profil
              </Button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Admin;
