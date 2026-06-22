import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, Send, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getPosterUrl } from "@/lib/tmdb";

export type SoireeRating = "memorable" | "good" | "meh";
export type FilmRating   = "love" | "like" | "not_for_me";

export interface PostSoireeEvent {
  eventId:      string;
  eventTitle:   string;
  eventDate:    string;
  context:      string;
  filmTitle:    string;
  filmPoster:   string | null;
  filmTmdbId:   number | null;
  participants: { id: string; name: string }[];
}

interface Props {
  event: PostSoireeEvent;
  onClose:    () => void;
  onComplete: () => void;
}

const SOIREE_OPTIONS: { value: SoireeRating; emoji: string; label: string }[] = [
  { value: "memorable", emoji: "🌟", label: "Mémorable" },
  { value: "good",      emoji: "👍", label: "Bonne soirée" },
  { value: "meh",       emoji: "😕", label: "Bof" },
];

const FILM_OPTIONS: { value: FilmRating; emoji: string; label: string }[] = [
  { value: "love",        emoji: "❤️", label: "Coup de cœur" },
  { value: "like",        emoji: "👍", label: "Bien" },
  { value: "not_for_me",  emoji: "👎", label: "Pas pour moi" },
];

const PHRASES: Record<FilmRating, string[]> = {
  love: [
    "Il restera longtemps en tête",
    "Exactement ce qu'il fallait ce soir",
    "Un film à revoir sans hésiter",
    "Une vraie claque cinématographique",
  ],
  like: [
    "Bon moment sans prise de tête",
    "Bien mais sans grande surprise",
    "Agréable, on ne regrette pas",
    "Correct, sans être marquant",
  ],
  not_for_me: [
    "L'histoire n'a pas accroché",
    "Ce soir-là, c'était pas le bon film",
    "Trop long / trop lent pour nous",
    "On s'attendait à autre chose",
  ],
};

type Friend = { id: string; name: string; avatarUrl?: string | null };

export default function PostSoireeFlow({ event, onClose, onComplete }: Props) {
  const { user } = useAuth();
  const [step, setStep]               = useState<1 | 2 | 3>(1);
  const [soireeRating, setSoireeRating] = useState<SoireeRating | null>(null);
  const [filmRating,   setFilmRating]   = useState<FilmRating | null>(null);
  const [filmPhrase,   setFilmPhrase]   = useState<string | null>(null);
  const [recommended,  setRecommended]  = useState<Set<string>>(new Set());
  const [saving,       setSaving]       = useState(false);
  const [done,         setDone]         = useState(false);
  const [friends,      setFriends]      = useState<Friend[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);

  const posterSrc = event.filmPoster ? getPosterUrl(event.filmPoster, "w185") : null;

  // Charge tous les amis acceptés dès le montage
  useEffect(() => {
    if (!user) return;
    setLoadingFriends(true);
    supabase
      .from("friendships" as any)
      .select("requester_id, addressee_id, status")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq("status", "accepted")
      .then(async ({ data: friendships }) => {
        if (!friendships?.length) { setLoadingFriends(false); return; }
        const otherIds = (friendships as any[]).map((f: any) =>
          f.requester_id === user.id ? f.addressee_id : f.requester_id,
        );
        const { data: profiles } = await supabase
          .from("profiles" as any)
          .select("id, display_name, avatar_url")
          .in("id", otherIds);
        const participantIds = new Set(event.participants.map((p) => p.id));
        const list: Friend[] = (profiles ?? []).map((p: any) => ({
          id: p.id,
          name: p.display_name || "Ami",
          avatarUrl: p.avatar_url,
        }));
        // Participants de la soirée en premier (s'ils ne sont pas déjà dans friends)
        const extras = event.participants.filter((p) => !list.find((f) => f.id === p.id));
        setFriends([...extras.map((p) => ({ id: p.id, name: p.name })), ...list]);
        setLoadingFriends(false);
      })
      .catch(() => setLoadingFriends(false));
  }, [user?.id]);

  const saveFeedback = async () => {
    if (!user || !soireeRating || !filmRating || !filmPhrase) return;
    setSaving(true);
    try {
      await supabase.from("event_film_feedback" as any).upsert({
        event_id:     event.eventId,
        user_id:      user.id,
        soiree_rating: soireeRating,
        film_rating:   filmRating,
        film_phrase:   filmPhrase,
      }, { onConflict: "event_id,user_id" });

      // Sync avec user_item_feedback si le film a un tmdb_id
      if (event.filmTmdbId) {
        const feedbackMap: Record<FilmRating, string> = {
          love: "love", like: "like", not_for_me: "not_for_me",
        };
        const { data: catalogItem } = await supabase
          .from("catalog_items")
          .select("id")
          .eq("tmdb_id", event.filmTmdbId)
          .maybeSingle();
        if (catalogItem?.id) {
          await supabase.from("user_item_feedback").upsert({
            user_id:       user.id,
            item_id:       catalogItem.id,
            feedback_type: feedbackMap[filmRating],
          }, { onConflict: "user_id,item_id,feedback_type" });
        }
      }
      setDone(true);
      setTimeout(onComplete, 1200);
    } catch (e) {
      console.error("PostSoireeFlow save error", e);
    } finally {
      setSaving(false);
    }
  };

  const sendRecommendation = async (friendId: string) => {
    if (!user || !event.filmTmdbId) return;
    setRecommended((prev) => new Set(prev).add(friendId));
    try {
      await supabase.from("shared_recommendations" as any).insert({
        sender_id:   user.id,
        receiver_id: friendId,
        tmdb_id:     event.filmTmdbId,
        title:       event.filmTitle,
        poster_path: event.filmPoster,
        message:     `${user.user_metadata?.full_name ?? "Quelqu'un"} pense que tu aimerais ce film`,
      });
    } catch (e) {
      console.error("recommendation send error", e);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-12 pb-4">
          <div>
            <p className="text-[11px] font-sans text-foreground/40 uppercase tracking-widest">
              Post-soirée
            </p>
            <h2 className="text-lg font-serif text-foreground leading-tight">
              {event.eventTitle}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-foreground/8 flex items-center justify-center"
          >
            <X className="w-4 h-4 text-foreground/60" />
          </button>
        </div>

        {/* Dots */}
        <div className="flex gap-1.5 px-5 mb-6">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1 rounded-full transition-all duration-300 ${
                s === step ? "w-6 bg-primary" : s < step ? "w-4 bg-primary/40" : "w-4 bg-foreground/10"
              }`}
            />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-8">

          {/* ── ÉTAPE 1 : SOIRÉE ── */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h3 className="text-2xl font-serif mb-1">La soirée</h3>
              <p className="text-sm text-foreground/50 font-sans mb-8">
                Comment tu retiens cette soirée ?
              </p>
              <div className="flex flex-col gap-3">
                {SOIREE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSoireeRating(opt.value)}
                    className={`flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${
                      soireeRating === opt.value
                        ? "border-primary bg-primary/8 ring-1 ring-primary/30"
                        : "border-border/20 hover:border-border/40"
                    }`}
                  >
                    <span className="text-3xl">{opt.emoji}</span>
                    <span className="text-base font-sans font-medium">{opt.label}</span>
                    {soireeRating === opt.value && (
                      <Check className="w-4 h-4 text-primary ml-auto" />
                    )}
                  </button>
                ))}
              </div>

              <Button
                variant="hero"
                size="xl"
                className="w-full mt-8"
                disabled={!soireeRating}
                onClick={() => setStep(2)}
              >
                Continuer <ArrowRight className="w-4 h-4" />
              </Button>
            </motion.div>
          )}

          {/* ── ÉTAPE 2 : LE FILM ── */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {/* Film header */}
              <div className="flex gap-3 mb-6">
                {posterSrc && (
                  <img
                    src={posterSrc}
                    alt={event.filmTitle}
                    className="w-14 aspect-[2/3] rounded-xl object-cover shrink-0"
                  />
                )}
                <div className="flex flex-col justify-center">
                  <h3 className="text-xl font-serif leading-tight">{event.filmTitle}</h3>
                  <p className="text-sm text-foreground/40 font-sans mt-0.5">Le film</p>
                </div>
              </div>

              {/* Film rating */}
              <p className="text-sm font-sans text-foreground/50 mb-3">Ton ressenti ?</p>
              <div className="flex flex-col gap-2.5 mb-6">
                {FILM_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setFilmRating(opt.value); setFilmPhrase(null); }}
                    className={`flex items-center gap-4 p-3.5 rounded-2xl border transition-all text-left ${
                      filmRating === opt.value
                        ? "border-primary bg-primary/8 ring-1 ring-primary/30"
                        : "border-border/20 hover:border-border/40"
                    }`}
                  >
                    <span className="text-2xl">{opt.emoji}</span>
                    <span className="text-sm font-sans font-medium">{opt.label}</span>
                    {filmRating === opt.value && (
                      <Check className="w-4 h-4 text-primary ml-auto" />
                    )}
                  </button>
                ))}
              </div>

              {/* Phrase */}
              {filmRating && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <p className="text-sm font-sans text-foreground/50 mb-3">En une phrase ?</p>
                  <div className="flex flex-col gap-2">
                    {PHRASES[filmRating].map((phrase) => (
                      <button
                        key={phrase}
                        onClick={() => setFilmPhrase(phrase)}
                        className={`px-4 py-3 rounded-xl border text-sm font-sans text-left transition-all ${
                          filmPhrase === phrase
                            ? "border-primary bg-primary/8 text-foreground ring-1 ring-primary/20"
                            : "border-border/20 text-foreground/60 hover:border-border/40"
                        }`}
                      >
                        {phrase}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              <Button
                variant="hero"
                size="xl"
                className="w-full mt-8"
                disabled={!filmRating || !filmPhrase}
                onClick={() => setStep(3)}
              >
                Continuer <ArrowRight className="w-4 h-4" />
              </Button>
            </motion.div>
          )}

          {/* ── ÉTAPE 3 : RECOMMANDER ── */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {done ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <Check className="w-7 h-7 text-primary" />
                  </div>
                  <p className="text-lg font-serif text-center">Merci pour ton retour !</p>
                </div>
              ) : (
                <>
                  <h3 className="text-2xl font-serif mb-1">Recommander</h3>
                  <p className="text-sm text-foreground/50 font-sans mb-6">
                    Ce film ferait plaisir à quelqu'un ?
                  </p>

                  {loadingFriends ? (
                    <div className="flex justify-center py-6">
                      <div className="w-5 h-5 rounded-full border-2 border-primary/40 border-t-primary animate-spin" />
                    </div>
                  ) : friends.length > 0 ? (
                    <div className="flex flex-col gap-2 mb-6">
                      {friends.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => void sendRecommendation(p.id)}
                          disabled={recommended.has(p.id)}
                          className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all ${
                            recommended.has(p.id)
                              ? "border-primary/30 bg-primary/8 opacity-70"
                              : "border-border/20 hover:border-border/40"
                          }`}
                        >
                          {p.avatarUrl ? (
                            <img
                              src={p.avatarUrl}
                              alt={p.name}
                              className="w-8 h-8 rounded-full object-cover shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-sans font-semibold text-primary shrink-0">
                              {p.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="text-sm font-sans flex-1 text-left">{p.name}</span>
                          {recommended.has(p.id) ? (
                            <Check className="w-4 h-4 text-primary ml-auto shrink-0" />
                          ) : (
                            <Send className="w-3.5 h-3.5 text-foreground/30 ml-auto shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm font-sans text-foreground/40 text-center py-4 mb-4">
                      Aucun ami dans l'app pour l'instant.
                    </p>
                  )}

                  <div className="flex flex-col gap-2">
                    <Button
                      variant="hero"
                      size="xl"
                      className="w-full"
                      disabled={saving}
                      onClick={() => void saveFeedback()}
                    >
                      {saving ? "Enregistrement…" : "Terminer"}
                    </Button>
                    <button
                      onClick={() => void saveFeedback()}
                      className="text-sm font-sans text-foreground/40 hover:text-foreground/60 py-2 transition-colors"
                    >
                      Passer sans recommander
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
