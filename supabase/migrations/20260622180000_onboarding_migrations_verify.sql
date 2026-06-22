-- Script de vérification / rattrapage manuel (idempotent).
-- Exécuter dans Supabase SQL Editor si une colonne initiatique manque en prod.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_step text NOT NULL DEFAULT 'welcome',
  ADD COLUMN IF NOT EXISTS onboarding_paused boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_films_progress integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarding_films_liked_ids integer[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS onboarding_films_proposed_ids integer[] NOT NULL DEFAULT '{}';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_actors_selected_ids integer[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS onboarding_actors_proposed_ids integer[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS onboarding_directors_selected_ids integer[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS onboarding_directors_proposed_ids integer[] NOT NULL DEFAULT '{}';
