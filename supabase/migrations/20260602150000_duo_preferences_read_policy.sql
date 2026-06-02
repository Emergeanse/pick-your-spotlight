-- Permet aux membres d'un duo actif de lire mutuellement leurs user_preferences
-- pour calculer les genres/origines exclus en commun dans DuoDetail

CREATE POLICY "Duo members can view each other preferences"
  ON public.user_preferences FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.duo_taste_profiles
      WHERE status = 'active'
        AND (
          (user1_id = auth.uid() AND user2_id = user_preferences.user_id) OR
          (user2_id = auth.uid() AND user1_id = user_preferences.user_id)
        )
    )
  );
