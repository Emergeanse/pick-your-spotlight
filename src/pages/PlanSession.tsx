import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, Clock, ArrowLeft, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createRecommendationSession } from "@/lib/sessions";
import { createGroupSession, addGuestMember } from "@/lib/group-sessions";
import { parsePickPrompt } from "@/lib/parse-prompt";
import { useAuth } from "@/hooks/use-auth";

/**
 * Pick V1 — Plan a future viewing session.
 * Solo: creates a recommendation_session with decision_mode=planned + scheduled_for.
 * Group: creates a group_session (planned) and routes to Pick Together to add members.
 */
const PlanSession = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [audience, setAudience] = useState<"solo" | "group">("solo");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("21:00");
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const minDate = new Date().toISOString().slice(0, 10);

  const handlePlan = async () => {
    if (!user) {
      toast.info("Connecte-toi pour planifier une séance");
      return;
    }
    if (!date) {
      toast.error("Choisis une date");
      return;
    }
    setSubmitting(true);
    try {
      const scheduledIso = new Date(`${date}T${time || "21:00"}:00`).toISOString();

      // Try to parse the free-form prompt to extract structured intent
      const parsed = prompt.trim() ? await parsePickPrompt(prompt) : null;
      const filtersSnapshot: Record<string, unknown> = parsed
        ? {
            mediaType: parsed.mediaType,
            mood: parsed.mood,
            genres: parsed.genres,
            excludedGenres: parsed.excludedGenres,
            maxDuration: parsed.maxDuration,
            platforms: parsed.platforms,
            keywords: parsed.keywords,
          }
        : {};

      // Override audience if the prompt clearly suggests a group
      const finalAudience = parsed?.audience === "group" ? "group" : audience;

      if (finalAudience === "group") {
        const session = await createGroupSession({
          title: title || "Soirée ciné",
          decision_mode: "planned",
          scheduled_for: scheduledIso,
          mood: parsed?.mood ?? null,
          context_json: { prompt, parsed },
        });
        // Pre-add detected guests on a best-effort basis
        if (parsed?.guests?.length) {
          for (const g of parsed.guests) {
            if (!g.name) continue;
            try {
              await addGuestMember((session as any).id, {
                name: g.name,
                age_range: g.ageHint ?? undefined,
                profile_text: g.relation ?? undefined,
              });
            } catch { /* ignore */ }
          }
        }
        toast.success("Séance planifiée — ajoute les participants");
        navigate(`/app/pick-together?session=${(session as any).id}`);
        return;
      }

      await createRecommendationSession({
        audience_type: "solo",
        decision_mode: "planned",
        scheduled_for: scheduledIso,
        prompt_text: prompt || null,
        source: "planned",
        filters_snapshot: filtersSnapshot,
      });
      toast.success("Séance planifiée");
      navigate("/app/history");
    } catch (e) {
      console.error(e);
      toast.error("Impossible de planifier la séance");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/30 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-lg hover:bg-foreground/5">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold">Planifier une séance</h1>
      </header>

      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        <p className="text-sm text-foreground/70">
          Programme un moment ciné — Pick préparera ses suggestions pour le jour J.
        </p>

        {/* Audience toggle */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setAudience("solo")}
            className={`p-4 rounded-xl border transition-colors ${
              audience === "solo"
                ? "border-primary bg-primary/10"
                : "border-border/30 hover:border-border/60"
            }`}
          >
            <Sparkles className="w-5 h-5 mx-auto mb-1.5" />
            <div className="text-sm font-medium">Pour moi</div>
          </button>
          <button
            onClick={() => setAudience("group")}
            className={`p-4 rounded-xl border transition-colors ${
              audience === "group"
                ? "border-primary bg-primary/10"
                : "border-border/30 hover:border-border/60"
            }`}
          >
            <Users className="w-5 h-5 mx-auto mb-1.5" />
            <div className="text-sm font-medium">En groupe</div>
          </button>
        </div>

        {audience === "group" && (
          <div className="space-y-1.5">
            <label className="text-xs text-foreground/60">Nom de la séance</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Soirée ciné chez Max"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs text-foreground/60 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Date
            </label>
            <Input type="date" min={minDate} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-foreground/60 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Heure
            </label>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-foreground/60">Envie particulière (optionnel)</label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Une comédie légère pour décompresser…"
            rows={3}
          />
        </div>

        <Button
          onClick={handlePlan}
          disabled={submitting || !date}
          className="w-full"
          size="lg"
        >
          {submitting ? "Planification…" : audience === "group" ? "Planifier et inviter" : "Planifier la séance"}
        </Button>
      </div>
    </div>
  );
};

export default PlanSession;
