/**
 * Cartographie des données rattachées à un compte.
 *
 * Source unique pour `export-my-data` et `delete-my-account`. Les deux doivent
 * couvrir exactement le même périmètre : exporter moins que ce qu'on supprime
 * priverait l'utilisateur d'une partie de ses données, supprimer moins que ce
 * qu'on exporte laisserait des traces après un effacement annoncé comme complet.
 *
 * ⚠️ Toute nouvelle table portant un `user_id` doit être ajoutée ici. C'est la
 * seule chose à tenir à jour — le reste en découle.
 *
 * L'ancienne fonction `admin-delete-user` n'en couvrait que douze sur les
 * vingt-quatre : duos, soirées, votes, sessions de recommandation, préférences
 * et scores survivaient à la suppression du compte.
 */

export interface UserDataTable {
  /** Nom de la table Postgres. */
  table: string;
  /** Colonnes qui désignent l'utilisateur. Plusieurs quand la relation est bilatérale. */
  columns: string[];
  /** Libellé lisible, repris tel quel dans le fichier d'export. */
  label: string;
}

/**
 * Ordonné pour la suppression : les lignes qui en référencent d'autres passent
 * avant celles qu'elles référencent. `profiles` ferme la marche, juste avant le
 * compte d'authentification lui-même.
 */
export const USER_DATA_TABLES: UserDataTable[] = [
  // — Traces d'usage et de personnalisation —
  { table: "user_interactions", columns: ["user_id"], label: "Interactions avec les films (vus, passés, aimés)" },
  { table: "user_item_feedback", columns: ["user_id"], label: "Retours détaillés sur des titres" },
  { table: "user_movie_scores", columns: ["user_id"], label: "Scores calculés par film" },
  { table: "user_taste_vectors", columns: ["user_id"], label: "Profil de goût vectoriel" },
  { table: "cinematic_profiles", columns: ["user_id"], label: "Profil cinématographique" },
  { table: "user_preferences", columns: ["user_id"], label: "Préférences" },
  { table: "user_people_preferences", columns: ["user_id"], label: "Acteurs et réalisateurs suivis" },
  { table: "liked_movies", columns: ["user_id"], label: "Films aimés" },
  { table: "watchlist", columns: ["user_id"], label: "Watchlist" },
  { table: "user_wishlist", columns: ["user_id"], label: "Envies de visionnage" },
  { table: "daily_usage", columns: ["user_id"], label: "Compteurs d'usage quotidien" },

  // — Historique de recommandation —
  { table: "recommendation_events", columns: ["user_id"], label: "Événements du moteur de recommandation" },
  { table: "recommendation_sessions", columns: ["user_id"], label: "Sessions de recommandation" },

  // — Social —
  { table: "notifications", columns: ["user_id"], label: "Notifications reçues" },
  { table: "shared_recommendations", columns: ["sender_id", "receiver_id"], label: "Recommandations partagées" },
  { table: "friendships", columns: ["requester_id", "addressee_id"], label: "Amitiés" },
  { table: "duo_taste_profiles", columns: ["user1_id", "user2_id"], label: "Duos" },

  // — Soirées et sessions de groupe —
  { table: "event_film_feedback", columns: ["user_id"], label: "Avis donnés lors de soirées" },
  { table: "event_participants", columns: ["user_id"], label: "Participations à des soirées" },
  { table: "group_session_members", columns: ["user_id"], label: "Participations à des sessions de groupe" },
  { table: "events", columns: ["organizer_id"], label: "Soirées organisées" },
  { table: "group_sessions", columns: ["creator_id"], label: "Sessions de groupe créées" },

  // — Compte —
  { table: "subscriptions", columns: ["user_id"], label: "Abonnement" },
  { table: "user_roles", columns: ["user_id"], label: "Rôles" },
  { table: "profiles", columns: ["id"], label: "Profil du compte" },
];

/**
 * Supprimer une soirée efface aussi ce que les autres participants y ont laissé.
 * C'est assumé : la soirée appartient à son organisateur et un effacement
 * annoncé comme complet ne peut pas en garder une moitié. Signalé ici pour que
 * le choix reste visible.
 */
export const CASCADES_TO_OTHERS = ["events", "group_sessions"];
