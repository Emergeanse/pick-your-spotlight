-- Table des profils duo : fusion de deux profils utilisateur
-- Un duo est créé par user1, user2 rejoint via invite_code
-- Les vecteurs mergés sont calculés côté client à l'acceptation

CREATE TABLE IF NOT EXISTS public.duo_taste_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identité
  duo_name text NOT NULL DEFAULT 'Notre Duo',
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user1_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user2_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Invitation
  invite_code text UNIQUE NOT NULL DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 16),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active')),

  -- Vecteurs de goût mergés (JSON, calculés à l'acceptation)
  taste_vector text,
  avoidance_vector text,

  -- Profil duo calculé
  affinity_score integer DEFAULT 0 CHECK (affinity_score >= 0 AND affinity_score <= 100),
  top_clusters text[] DEFAULT '{}',
  rejected_clusters text[] DEFAULT '{}',
  excluded_genres text[] DEFAULT '{}',

  -- Genres résumés pour affichage (calculés à l'acceptation)
  user1_display_name text,
  user2_display_name text,
  user1_genres text[] DEFAULT '{}',
  user2_genres text[] DEFAULT '{}',
  common_genres text[] DEFAULT '{}',

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index pour lookup rapide par utilisateur
CREATE INDEX IF NOT EXISTS duo_taste_profiles_user1_idx ON public.duo_taste_profiles (user1_id);
CREATE INDEX IF NOT EXISTS duo_taste_profiles_user2_idx ON public.duo_taste_profiles (user2_id);
CREATE INDEX IF NOT EXISTS duo_taste_profiles_invite_code_idx ON public.duo_taste_profiles (invite_code);

-- RLS
ALTER TABLE public.duo_taste_profiles ENABLE ROW LEVEL SECURITY;

-- Chacun des deux membres peut lire son duo
CREATE POLICY "Duo members can view" ON public.duo_taste_profiles
  FOR SELECT TO authenticated
  USING (user1_id = auth.uid() OR user2_id = auth.uid());

-- Seul le créateur peut modifier le nom et les métadonnées
CREATE POLICY "Duo creator can update" ON public.duo_taste_profiles
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR user1_id = auth.uid() OR user2_id = auth.uid());

-- Seul user1 (créateur) peut créer
CREATE POLICY "Authenticated users can create duo" ON public.duo_taste_profiles
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND user1_id = auth.uid());

-- Seul un membre peut supprimer son duo
CREATE POLICY "Duo members can delete" ON public.duo_taste_profiles
  FOR DELETE TO authenticated
  USING (user1_id = auth.uid() OR user2_id = auth.uid());

-- Lecture publique limitée pour la page d'invitation (invite_code lookup par n'importe quel user connecté)
CREATE POLICY "Any authenticated user can view pending duo by invite code" ON public.duo_taste_profiles
  FOR SELECT TO authenticated
  USING (status = 'pending');
