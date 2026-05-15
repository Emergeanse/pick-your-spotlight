-- Add a profile-level default recommendation count for personalized search results.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS default_recommendation_count integer NOT NULL DEFAULT 5;
