
-- Add engagement tracking columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS streak_count integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS best_streak integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_recommendation_date date,
ADD COLUMN IF NOT EXISTS total_recommendations integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS accepted_recommendations integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS profile_confidence integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS ritual_time time,
ADD COLUMN IF NOT EXISTS ritual_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS hook_messages_seen text[] NOT NULL DEFAULT '{}'::text[],
ADD COLUMN IF NOT EXISTS first_use_date date;
