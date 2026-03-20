/**
 * Time-aware context for adapting UI labels and AI messages
 * to the current period of the day.
 */

export type DayPeriod = "morning" | "afternoon" | "evening" | "night";

export function getDayPeriod(date: Date = new Date()): DayPeriod {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

export function getGreeting(date: Date = new Date()): string {
  const period = getDayPeriod(date);
  switch (period) {
    case "morning": return "Bonjour";
    case "afternoon": return "Bon après-midi";
    case "evening": return "Bonsoir";
    case "night": return "Bonne nuit";
  }
}

/** Label for the main CTA button — adapts to time of day */
export function getMainCTALabel(date: Date = new Date()): string {
  const period = getDayPeriod(date);
  switch (period) {
    case "morning": return "Trouver un film";
    case "afternoon": return "Trouver un film";
    case "evening": return "Trouver mon film";
    case "night": return "Trouver mon film";
  }
}

/** Subtitle for the main CTA */
export function getMainCTASubtitle(date: Date = new Date()): string {
  const period = getDayPeriod(date);
  switch (period) {
    case "morning": return "Laisse Pick te préparer ta prochaine séance.";
    case "afternoon": return "Laisse Pick te dénicher une pépite.";
    case "evening": return "Laisse Pick te guider vers ta soirée parfaite.";
    case "night": return "Laisse Pick trouver le film parfait pour cette nuit.";
  }
}

/** Label for "Pick choisit pour toi" */
export function getAutoPickLabel(date: Date = new Date()): string {
  const period = getDayPeriod(date);
  switch (period) {
    case "morning": return "Pick choisit pour toi";
    case "afternoon": return "Pick choisit pour toi";
    case "evening": return "Pick choisit pour ce soir";
    case "night": return "Pick choisit pour cette nuit";
  }
}

/** Subtitle for auto pick */
export function getAutoPickSubtitle(date: Date = new Date()): string {
  const period = getDayPeriod(date);
  switch (period) {
    case "morning": return "Une suggestion sur-mesure, instantanée.";
    case "afternoon": return "Une suggestion sur-mesure, instantanée.";
    case "evening": return "La suggestion parfaite pour ce soir.";
    case "night": return "Le film idéal pour finir la nuit.";
  }
}

/** Tonight's Pick badge label */
export function getTonightPickLabel(date: Date = new Date()): string {
  const period = getDayPeriod(date);
  switch (period) {
    case "morning": return "Pick du jour";
    case "afternoon": return "Pick du moment";
    case "evening": return "Tonight's Pick";
    case "night": return "Tonight's Pick";
  }
}

/** Proactive messages from Pick, adapted to time */
export function getProactiveMessages(date: Date = new Date()): string[] {
  const period = getDayPeriod(date);
  const base = [
    "Tiens, j'ai pensé à un truc qui devrait te plaire.",
    "Avant que tu choisisses… regarde celui-là.",
    "Psst… j'ai trouvé quelque chose.",
    "Tu vas me remercier pour celui-là.",
    "Regarde ce que j'ai trouvé en fouillant pour toi.",
    "Du sur-mesure pour toi.",
    "J'ai une suggestion qui te correspond bien.",
    "Celui-ci a ton nom écrit dessus.",
  ];

  switch (period) {
    case "morning":
      return [
        "J'ai peut-être la recommandation parfaite pour plus tard.",
        "J'ai une idée pour ta prochaine séance.",
        ...base,
      ];
    case "afternoon":
      return [
        "J'ai une idée pour cet après-midi.",
        "Un petit film pour l'après-midi ?",
        ...base,
      ];
    case "evening":
      return [
        "J'ai peut-être la recommandation parfaite pour ce soir.",
        "J'ai une idée pour toi ce soir.",
        "Je crois que j'ai trouvé ta soirée.",
        "Un petit bijou juste pour toi ce soir.",
        ...base,
      ];
    case "night":
      return [
        "Le film parfait pour cette fin de soirée.",
        "J'ai un truc idéal pour cette nuit.",
        ...base,
      ];
  }
}

/** Returns a time context string to inject into AI system prompts */
export function getTimeContextForPrompt(date: Date = new Date()): string {
  const period = getDayPeriod(date);
  const hour = date.getHours();
  const dayNames = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const dayName = dayNames[date.getDay()];
  
  const periodLabel: Record<DayPeriod, string> = {
    morning: "le matin",
    afternoon: "l'après-midi",
    evening: "en soirée",
    night: "tard dans la nuit",
  };

  return `Nous sommes ${dayName}, il est ${hour}h (${periodLabel[period]}). Adapte ton ton et tes formulations à ce moment de la journée. Par exemple, ne dis pas "ce soir" si c'est le matin — dis plutôt "pour ta prochaine séance" ou "pour plus tard". Si c'est le soir ou la nuit, tu peux dire "ce soir" ou "cette nuit".`;
}
