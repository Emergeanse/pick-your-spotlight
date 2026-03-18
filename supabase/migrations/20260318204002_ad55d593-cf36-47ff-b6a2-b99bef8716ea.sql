
-- Fix search_path for generate_friend_code
CREATE OR REPLACE FUNCTION public.generate_friend_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  code text;
  exists_already boolean;
BEGIN
  LOOP
    code := 'PICK-' || upper(substr(md5(random()::text), 1, 4));
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE friend_code = code) INTO exists_already;
    IF NOT exists_already THEN
      RETURN code;
    END IF;
  END LOOP;
END;
$$;
