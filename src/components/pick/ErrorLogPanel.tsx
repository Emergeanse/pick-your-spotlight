/**
 * Les dernières erreurs remontées par les navigateurs, pour la page admin.
 *
 * Volontairement sobre : une liste datée, repliable, avec la pile complète à la
 * demande. Le but est de savoir qu'une erreur existe et où elle tombe — pas de
 * refaire un outil d'observabilité.
 */
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ChevronDown, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ErrorEvent {
  id: string;
  user_id: string | null;
  source: string;
  message: string;
  stack: string | null;
  route: string | null;
  created_at: string;
  context: Record<string, unknown> | null;
}

const LIMITE = 50;

const quand = (iso: string): string => {
  const d = new Date(iso);
  const minutes = Math.round((Date.now() - d.getTime()) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  if (minutes < 1440) return `il y a ${Math.round(minutes / 60)} h`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};

const ErrorLogPanel = () => {
  const [events, setEvents] = useState<ErrorEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [ouvert, setOuvert] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("error_events")
      .select("id, user_id, source, message, stack, route, created_at, context")
      .order("created_at", { ascending: false })
      .limit(LIMITE);
    if (error) console.error("[admin] lecture des erreurs:", error.message);
    setEvents((data ?? []) as ErrorEvent[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  return (
    <section className="rounded-2xl border border-border/15 bg-card/40 p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-primary" />
          <h2 className="font-serif text-base text-foreground">Erreurs récentes</h2>
          {!loading && (
            <span className="text-xs font-sans text-foreground/40">
              {events.length === 0 ? "aucune" : `${events.length}${events.length === LIMITE ? "+" : ""}`}
            </span>
          )}
        </div>
        <button
          onClick={charger}
          disabled={loading}
          aria-label="Recharger les erreurs"
          className="p-2 rounded-lg text-foreground/50 hover:text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-40"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        </button>
      </div>

      {!loading && events.length === 0 && (
        <p className="text-sm font-sans text-foreground/45">
          Rien à signaler. C'est la bonne nouvelle qu'on espère lire ici.
        </p>
      )}

      <ul className="space-y-1.5">
        {events.map((e) => (
          <li key={e.id} className="rounded-xl border border-border/10 bg-background/40">
            <button
              onClick={() => setOuvert(ouvert === e.id ? null : e.id)}
              aria-expanded={ouvert === e.id}
              className="w-full text-left px-3.5 py-2.5 flex items-start gap-2.5"
            >
              <ChevronDown
                className={`w-3.5 h-3.5 mt-0.5 shrink-0 text-foreground/35 transition-transform ${ouvert === e.id ? "rotate-180" : ""}`}
              />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-sans text-foreground/80 truncate">{e.message}</span>
                <span className="block text-[11px] font-sans text-foreground/40 mt-0.5">
                  {quand(e.created_at)}
                  {e.route ? ` · ${e.route}` : ""}
                  {e.user_id ? " · connecté" : " · visiteur"}
                </span>
              </span>
            </button>

            {ouvert === e.id && (
              <div className="px-3.5 pb-3 pt-0.5 space-y-2 border-t border-border/10">
                {e.context && Object.keys(e.context).length > 0 && (
                  <p className="text-[11px] font-sans text-foreground/50 pt-2">
                    {String((e.context as { origine?: string }).origine ?? "")}
                  </p>
                )}
                <pre className="text-[10px] font-mono text-foreground/45 whitespace-pre-wrap break-words max-h-56 overflow-y-auto">
                  {e.stack ?? "Pas de pile d'appels."}
                </pre>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
};

export default ErrorLogPanel;
