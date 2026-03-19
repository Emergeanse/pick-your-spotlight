import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, UserPlus, Loader2, Shield, Calendar } from "lucide-react";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdUsers, setCreatedUsers] = useState<{ email: string; id: string }[]>([]);

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
          email,
          password,
          displayName: displayName || undefined,
          birthYear: birthYear ? parseInt(birthYear) : undefined,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast.success(`Utilisateur ${email} créé !`);
      setCreatedUsers(prev => [{ email, id: data.userId }, ...prev]);
      setEmail("");
      setPassword("");
      setDisplayName("");
      setBirthYear("");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la création");
    } finally {
      setCreating(false);
    }
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

          <form onSubmit={handleCreate} className="space-y-4 mb-8">
            <div>
              <label className="text-xs text-muted-foreground font-sans mb-1 block">Email *</label>
              <Input
                type="email"
                placeholder="test@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="bg-card border-border/30"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground font-sans mb-1 block">Mot de passe *</label>
              <Input
                type="text"
                placeholder="min. 6 caractères"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                className="bg-card border-border/30"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground font-sans mb-1 block">Prénom</label>
              <Input
                type="text"
                placeholder="Prénom du compte test"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="bg-card border-border/30"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground font-sans mb-1 block">Année de naissance</label>
              <Input
                type="number"
                placeholder={`ex: 1995`}
                value={birthYear}
                onChange={e => setBirthYear(e.target.value)}
                min={1920}
                max={currentYear - 5}
                className="bg-card border-border/30"
              />
            </div>

            <Button
              type="submit"
              variant="hero"
              size="xl"
              className="w-full"
              disabled={creating || !email || password.length < 6}
            >
              {creating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Créer le compte
                </>
              )}
            </Button>
          </form>

          {createdUsers.length > 0 && (
            <div>
              <h2 className="text-sm font-sans font-medium text-muted-foreground mb-3">Comptes créés cette session</h2>
              <div className="space-y-2">
                {createdUsers.map(u => (
                  <div key={u.id} className="bg-card rounded-xl px-4 py-3 flex items-center justify-between">
                    <span className="text-sm font-sans">{u.email}</span>
                    <span className="text-xs text-muted-foreground font-mono">{u.id.slice(0, 8)}…</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Admin;
