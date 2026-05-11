import { supabase } from "@/integrations/supabase/client";

export interface SessionWish {
  summary: string | null;
  genres: string[];
  mood: string | null;
  keywords: string[];
  era: string | null;
  maxDuration: number | null;
}

export interface ParticipantHint {
  name: string | null;
  ageHint: string | null;
  relation: string | null;
  genres: string[];
  excludedGenres: string[];
  era: string | null;
  notes: string | null;
}

export interface ParsedPickPrompt {
  audience: "solo" | "group";
  mediaType: "movie" | "tv" | "both";
  sessionWish: SessionWish;
  participantHints: ParticipantHint[];
  timeOfDay: "now" | "tonight" | "later" | null;
  scheduledHint: string | null;
  platforms: string[];
  blocking: string | null;
}

/**
 * Calls parse-pick-prompt edge function. Separates session wish (ephemeral)
 * from participant hints (durable preference candidates — never auto-persisted).
 */
export async function parsePickPrompt(prompt: string): Promise<ParsedPickPrompt | null> {
  const trimmed = prompt?.trim();
  if (!trimmed) return null;
  try {
    const { data, error } = await supabase.functions.invoke("parse-pick-prompt", {
      body: { prompt: trimmed },
    });
    if (error) {
      console.warn("parse-pick-prompt error", error);
      return null;
    }
    return (data?.parsed as ParsedPickPrompt) ?? null;
  } catch (e) {
    console.warn("parse-pick-prompt exception", e);
    return null;
  }
}
