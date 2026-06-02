-- Permet aux membres d'un duo actif de lire mutuellement leurs profils
-- (excluded_genres, favorite_genres, etc.) pour le calcul des goûts communs

CREATE POLICY "Duo members can view each other profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    auth.uid() = id OR
    EXISTS (
      SELECT 1 FROM public.duo_taste_profiles
      WHERE status = 'active'
        AND (
          (user1_id = auth.uid() AND user2_id = profiles.id) OR
          (user2_id = auth.uid() AND user1_id = profiles.id)
        )
    )
  );
