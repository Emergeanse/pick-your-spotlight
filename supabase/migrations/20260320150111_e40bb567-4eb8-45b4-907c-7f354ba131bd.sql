
-- Réinitialisation complète des données de recommandation de tous les utilisateurs
-- Les embeddings de films sont conservés (c'est du cache réutilisable)

-- 1. Supprimer toutes les interactions utilisateur
DELETE FROM public.user_interactions;

-- 2. Supprimer tous les films likés
DELETE FROM public.liked_movies;

-- 3. Supprimer toutes les watchlists
DELETE FROM public.watchlist;

-- 4. Supprimer tous les vecteurs de goût
DELETE FROM public.user_taste_vectors;

-- 5. Supprimer tous les événements de recommandation
DELETE FROM public.recommendation_events;

-- 6. Supprimer tous les profils cinématographiques
DELETE FROM public.cinematic_profiles;

-- 7. Supprimer les métriques moteur
DELETE FROM public.engine_metrics;

-- 8. Supprimer le daily usage
DELETE FROM public.daily_usage;

-- 9. Réinitialiser les compteurs dans profiles
UPDATE public.profiles SET
  total_recommendations = 0,
  accepted_recommendations = 0,
  profile_confidence = 0,
  streak_count = 0,
  best_streak = 0,
  last_recommendation_date = NULL,
  activation_completed = false,
  activation_step = 'train_20',
  tour_completed = false,
  hook_messages_seen = '{}';
