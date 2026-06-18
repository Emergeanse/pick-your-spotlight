import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, Calendar, Users, Sparkles, Film, Clock, CheckCircle2, XCircle } from "lucide-react";
import PickCharacter from "@/components/pick/PickCharacter";

interface RecoSession {
  id: string;
  created_at: string;
  status: string;
  audience_type: string;
  decision_mode: string;
  scheduled_for: string | null;
  source: string;
  prompt_text: string | null;
  selected_catalog_item_id: string | null;
  group_session_id: string | null;
  filters_snapshot: any;
}

interface GroupSession {
  id: string;
  name: string;
  title: string | null;
  status: string;
  scheduled_for: string | null;
  created_at: string;
  decision_mode: string;
  selected_catalog_item_id: string | null;
}

interface CatalogLite { id: string; title: string; poster_path: string | null }

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
    completed: { label: "Vu", cls: "bg-primary/15 text-primary", Icon: CheckCircle2 },
    active:    { label: "En cours", cls: "bg-secondary/40 text-foreground/80", Icon: Sparkles },
    abandoned: { label: "Abandonnée", cls: "bg-muted/40 text-foreground/40", Icon: XCircle },
  };
  const cfg = map[status] || map.active;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] ${cfg.cls}`}>
      <cfg.Icon className="w-3 h-3" /> {cfg.label}
    </span>
  );
};

const HistoryPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [recos, setRecos] = useState<RecoSession[]>([]);
  const [groups, setGroups] = useState<GroupSession[]>([]);
  const [catalogMap, setCatalogMap] = useState<Record<string, CatalogLite>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "solo" | "group" | "planned">("all");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [recoRes, groupRes] = await Promise.all([
          supabase
            .from("recommendation_sessions")
            .select("id, created_at, status, audience_type, decision_mode, scheduled_for, source, prompt_text, selected_catalog_item_id, group_session_id, filters_snapshot")
            .order("created_at", { ascending: false })
            .limit(100),
          supabase
            .from("group_sessions")
            .select("id, name, title, status, scheduled_for, created_at, decision_mode, selected_catalog_item_id")
            .order("created_at", { ascending: false })
            .limit(50),
        ]);
        if (cancelled) return;
        const recoList = (recoRes.data ?? []) as any as RecoSession[];
        const groupList = (groupRes.data ?? []) as any as GroupSession[];
        setRecos(recoList);
        setGroups(groupList);

        const itemIds = new Set<string>();
        recoList.forEach(r => r.selected_catalog_item_id && itemIds.add(r.selected_catalog_item_id));
        groupList.forEach(g => g.selected_catalog_item_id && itemIds.add(g.selected_catalog_item_id));
        if (itemIds.size > 0) {
          const { data: cats } = await supabase
            .from("catalog_items")
            .select("id, title, poster_path")
            .in("id", Array.from(itemIds));
          if (!cancelled && cats) {
            const map: Record<string, CatalogLite> = {};
            (cats as any[]).forEach(c => { map[c.id] = c; });
            setCatalogMap(map);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const filteredRecos = recos.filter(r => {
    if (tab === "all") return true;
    if (tab === "planned") return r.decision_mode === "planned";
    return r.audience_type === tab;
  });

  const totalCount = recos.length + groups.length;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/30 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-lg hover:bg-foreground/5">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold">Mon historique</h1>
      </header>

      <div className="max-w-md mx-auto px-4 py-5">
        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4">
          {[
            { k: "all", label: "Tout" },
            { k: "solo", label: "Solo" },
            { k: "group", label: "Groupe" },
            { k: "planned", label: "Planifiées" },
          ].map(t => (
            <button
              key={t.k}
              onClick={() => setTab(t.k as any)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm border ${
                tab === t.k
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border/40 hover:border-border/70 text-foreground/70"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="text-center py-12 text-foreground/50 text-sm">Chargement…</div>
        )}

        {!loading && totalCount === 0 && (
          <div className="text-center py-16">
            <PickCharacter mood="default" size="md" animate={false} />
            <p className="text-foreground/60 text-sm mt-4">Aucune séance pour le moment.</p>
            <button
              onClick={() => navigate("/app")}
              className="mt-5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm"
            >
              Lancer ma première séance
            </button>
          </div>
        )}

        {/* Group sessions */}
        {!loading && tab !== "solo" && groups.length > 0 && (
          <section className="mb-6">
            <h2 className="text-xs uppercase tracking-wider text-foreground/40 mb-2 flex items-center gap-1.5">
              <Users className="w-3 h-3" /> Soirées en groupe
            </h2>
            <div className="space-y-2">
              {groups.map(g => {
                const cat = g.selected_catalog_item_id ? catalogMap[g.selected_catalog_item_id] : null;
                const isFuture = g.scheduled_for && new Date(g.scheduled_for) > new Date();
                return (
                  <button
                    key={g.id}
                    onClick={() => navigate(`/app/pick-together?session=${g.id}`)}
                    className="w-full text-left p-3 rounded-xl border border-border/30 bg-card/40 hover:bg-card/70 transition-colors flex gap-3"
                  >
                    {cat?.poster_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w92${cat.poster_path}`}
                        alt=""
                        className="w-12 h-16 object-cover rounded-md shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-16 rounded-md bg-muted/30 flex items-center justify-center shrink-0">
                        <Users className="w-5 h-5 text-foreground/45" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium text-sm truncate">{g.title || g.name}</div>
                        <StatusBadge status={g.status} />
                      </div>
                      {cat && <div className="text-xs text-foreground/60 truncate">🎬 {cat.title}</div>}
                      <div className="text-[11px] text-foreground/40 mt-1 flex items-center gap-2">
                        {g.scheduled_for ? (
                          <>
                            <Calendar className="w-3 h-3" />
                            {formatDate(g.scheduled_for)}
                            {isFuture && <span className="text-primary">à venir</span>}
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3" /> {formatDate(g.created_at)}
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Solo / reco sessions */}
        {!loading && tab !== "group" && filteredRecos.length > 0 && (
          <section>
            <h2 className="text-xs uppercase tracking-wider text-foreground/40 mb-2 flex items-center gap-1.5">
              <Film className="w-3 h-3" /> Séances
            </h2>
            <div className="space-y-2">
              {filteredRecos.map(r => {
                const cat = r.selected_catalog_item_id ? catalogMap[r.selected_catalog_item_id] : null;
                const isFuture = r.scheduled_for && new Date(r.scheduled_for) > new Date();
                return (
                  <div
                    key={r.id}
                    className="w-full text-left p-3 rounded-xl border border-border/30 bg-card/40 flex gap-3"
                  >
                    {cat?.poster_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w92${cat.poster_path}`}
                        alt=""
                        className="w-12 h-16 object-cover rounded-md shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-16 rounded-md bg-muted/30 flex items-center justify-center shrink-0">
                        {r.audience_type === "group" ? <Users className="w-5 h-5 text-foreground/45" /> : <Sparkles className="w-5 h-5 text-foreground/45" />}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium text-sm truncate">
                          {cat?.title || r.prompt_text || (r.audience_type === "group" ? "Séance groupe" : "Séance solo")}
                        </div>
                        <StatusBadge status={r.status} />
                      </div>
                      <div className="text-[11px] text-foreground/40 mt-1 flex items-center gap-2 flex-wrap">
                        {r.scheduled_for ? (
                          <>
                            <Calendar className="w-3 h-3" />
                            {formatDate(r.scheduled_for)}
                            {isFuture && <span className="text-primary">à venir</span>}
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3" /> {formatDate(r.created_at)}
                          </>
                        )}
                        <span className="text-foreground/45">·</span>
                        <span>{r.audience_type === "group" ? "Groupe" : "Solo"}</span>
                        {r.decision_mode === "planned" && <span className="text-foreground/45">· Planifiée</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default HistoryPage;
