CREATE POLICY "Friends can view cinematic profiles"
ON public.cinematic_profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
    AND (
      (requester_id = auth.uid() AND addressee_id = cinematic_profiles.user_id)
      OR (addressee_id = auth.uid() AND requester_id = cinematic_profiles.user_id)
    )
  )
);