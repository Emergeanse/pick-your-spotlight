DROP POLICY IF EXISTS "Duo creator can update" ON public.duo_taste_profiles;

CREATE POLICY "Duo members can update"
  ON public.duo_taste_profiles
  FOR UPDATE TO authenticated
  USING (
    user1_id = auth.uid()
    OR (user2_id IS NOT NULL AND user2_id = auth.uid())
  )
  WITH CHECK (
    user1_id = auth.uid()
    OR (user2_id IS NOT NULL AND user2_id = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.claim_pending_duo(_invite_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_duo_id uuid;
  v_user1  uuid;
  v_display_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  SELECT id, user1_id INTO v_duo_id, v_user1
  FROM public.duo_taste_profiles
  WHERE invite_code = _invite_code
    AND status = 'pending'
    AND user2_id IS NULL
  LIMIT 1;

  IF v_duo_id IS NULL THEN
    RAISE EXCEPTION 'invalid or already claimed invite';
  END IF;

  IF v_user1 = auth.uid() THEN
    RAISE EXCEPTION 'cannot join your own duo';
  END IF;

  SELECT display_name INTO v_display_name
  FROM public.profiles WHERE id = auth.uid();

  UPDATE public.duo_taste_profiles
  SET user2_id = auth.uid(),
      user2_display_name = COALESCE(v_display_name, user2_display_name),
      status = 'active',
      updated_at = now()
  WHERE id = v_duo_id;

  RETURN v_duo_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_pending_duo(text) TO authenticated;