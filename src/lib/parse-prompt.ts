import { supabase } from "@/integrations/supabase/client";

export interface ParsedPickPrompt {
  audience: "solo" | "group";
  mediaType: "movie" | "tv" | "both";
  mood: string | null;
  genres: string[];
  excludedGenres: string[];
  maxDuration: number | null;
  timeOfDay: "now" | "tonight" | "later" | null;
  scheduledHint: string | null;
  guests: { name: string | null; ageHint: string | null; relation: string | null }[];
  groupSize: number | null;
  platforms: string[];
  keywords: string[];
}

/**
 * Calls the parse-pick-prompt edge function to extract structured intent
 * from a free-form user phrase. Returns null on error so the caller can
 * fall back gracefully (the original prompt remains stored as raw text).
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
