-- Permet aux membres d'un duo actif de lire mutuellement leurs feedbacks
-- pour calculer les films en commun dans DuoDetail

CREATE POLICY "Duo members can view partner feedback"
  ON public.user_item_feedback FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.duo_taste_profiles
      WHERE status = 'active'
        AND (
          (user1_id = auth.uid() AND user2_id = user_item_feedback.user_id) OR
          (user2_id = auth.uid() AND user1_id = user_item_feedback.user_id)
        )
    )
  );
