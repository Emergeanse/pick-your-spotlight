import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, UserPlus, Loader2, Shield, LogIn, Users, RefreshCw, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { useAdmin } from "@/hooks/use-admin";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOnlineUsers } from "@/hooks/use-presence";

interface RegisteredUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  display_name: string | null;
  birth_year: number | null;
  is_test_account: boolean;
  onboarding_completed: boolean;
  total_recommendations: number;
  streak_count: number;
}

const Admin = () => {
  const navigate = useNavigate();
  const { user, isReady } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [displayName, setDisplayName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdAccount, setCreatedAccount] = useState<{ email: string; password: string; name: string } | null>(null);

  // Users list
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const onlineUsers = useOnlineUsers(isAdmin);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-list-users");
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setUsers(data.users || []);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors du chargement");
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (isAdmin && user) {
      fetchUsers();
    }
  }, [isAdmin, user]);

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
      fetchUsers(); // Refresh list
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la création");
    } finally {
      setCreating(false);
    }
  };

  const handleLoginAsTestUser = async () => {
    if (!createdAccount) return;
    await supabase.auth.signOut();
    const { error } = await supabase.auth.signInWithPassword({
      email: createdAccount.email,
      password: createdAccount.password,
    });
    if (error) {
      toast.error("Connexion échouée : " + error.message);
      return;
    }
    // Full page reload to ensure clean state — no data leaks from admin session
    window.location.href = "/app";
  };

  const currentYear = new Date().getFullYear();
  const realUsers = users.filter(u => !u.is_test_account);
  const testUsers = users.filter(u => u.is_test_account);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const onlineUserIds = new Set(onlineUsers.map(u => u.user_id));

  const UserTable = ({ userList }: { userList: RegisteredUser[] }) => (
    <div className="rounded-xl border border-border/30 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-card/50">
            <TableHead className="text-xs font-sans w-8"></TableHead>
            <TableHead className="text-xs font-sans">Nom</TableHead>
            <TableHead className="text-xs font-sans">Email</TableHead>
            <TableHead className="text-xs font-sans">Inscription</TableHead>
            <TableHead className="text-xs font-sans">Dernière connexion</TableHead>
            <TableHead className="text-xs font-sans text-center">Recos</TableHead>
            <TableHead className="text-xs font-sans text-center">Streak</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {userList.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground text-sm py-8">
                Aucun utilisateur
              </TableCell>
            </TableRow>
          ) : (
            userList.map((u) => {
              const isOnline = onlineUserIds.has(u.id);
              return (
                <TableRow key={u.id} className="bg-card/30">
                  <TableCell className="w-8 pr-0">
                    <Circle
                      className={`w-2.5 h-2.5 ${isOnline ? "fill-green-500 text-green-500" : "fill-foreground/10 text-foreground/10"}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium text-sm">
                    <div className="flex items-center gap-2">
                      {u.display_name || "—"}
                      {u.is_test_account && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">
                          test
                        </Badge>
                      )}
                      {u.onboarding_completed && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          onboardé
                        </Badge>
                      )}
                    </div>
                    {u.birth_year && (
                      <span className="text-xs text-muted-foreground">{currentYear - u.birth_year} ans</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">{u.email}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(u.created_at)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(u.last_sign_in_at)}</TableCell>
                  <TableCell className="text-center text-sm">{u.total_recommendations}</TableCell>
                  <TableCell className="text-center text-sm">{u.streak_count > 0 ? `🔥 ${u.streak_count}` : "—"}</TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-background overflow-y-auto">
      <div className="max-w-4xl mx-auto p-5 pb-20">
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
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{users.length} utilisateur{users.length > 1 ? "s" : ""} inscrit{users.length > 1 ? "s" : ""}</span>
                <span className="flex items-center gap-1.5">
                  <Circle className="w-2 h-2 fill-green-500 text-green-500 animate-pulse" />
                  {onlineUsers.length} en ligne
                </span>
              </div>
            </div>
          </div>

          <Tabs defaultValue="users" className="space-y-6">
            <TabsList className="bg-card/50 border border-border/30">
              <TabsTrigger value="users" className="gap-1.5 text-xs">
                <Users className="w-3.5 h-3.5" />
                Utilisateurs ({users.length})
              </TabsTrigger>
              <TabsTrigger value="create" className="gap-1.5 text-xs">
                <UserPlus className="w-3.5 h-3.5" />
                Créer un profil test
              </TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-serif">Tous les utilisateurs</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchUsers}
                  disabled={loadingUsers}
                  className="text-xs gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingUsers ? "animate-spin" : ""}`} />
                  Actualiser
                </Button>
              </div>

              {loadingUsers && users.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-6">
                  {realUsers.length > 0 && (
                    <div>
                      <h3 className="text-sm font-sans text-muted-foreground mb-2">
                        Comptes réels ({realUsers.length})
                      </h3>
                      <UserTable userList={realUsers} />
                    </div>
                  )}
                  {testUsers.length > 0 && (
                    <div>
                      <h3 className="text-sm font-sans text-muted-foreground mb-2">
                        Comptes test éphémères ({testUsers.length})
                      </h3>
                      <UserTable userList={testUsers} />
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="create">
              {!createdAccount ? (
                <form onSubmit={handleCreate} className="space-y-4 max-w-md">
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
                  className="space-y-4 max-w-md"
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
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
};

export default Admin;
