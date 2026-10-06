-- Le prénom saisi à l'inscription n'arrivait jamais dans le profil.
--
-- Le formulaire l'envoie dans les métadonnées du compte (display_name), mais
-- handle_new_user() ne copiait que l'identifiant : profiles.display_name restait
-- vide. Résultat : « Ami » dans la liste d'amis, « Un ami » dans les conseils et
-- les notifications. Les comptes Google / Apple n'en avaient pas davantage.

-- 1. À la création du compte, reprendre le prénom (ou le nom Google / Apple).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    NULLIF(left(trim(COALESCE(
      NEW.raw_user_meta_data ->> 'display_name',
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      ''
    )), 40), '')
  );
  RETURN NEW;
END;
$$;

-- 2. Rattrapage des comptes existants : seulement là où le profil n'a pas de
--    prénom, sans jamais écraser un prénom choisi depuis.
UPDATE public.profiles p
SET display_name = NULLIF(left(trim(COALESCE(
      u.raw_user_meta_data ->> 'display_name',
      u.raw_user_meta_data ->> 'full_name',
      u.raw_user_meta_data ->> 'name',
      ''
    )), 40), '')
FROM auth.users u
WHERE u.id = p.id
  AND (p.display_name IS NULL OR trim(p.display_name) = '')
  AND NULLIF(trim(COALESCE(
      u.raw_user_meta_data ->> 'display_name',
      u.raw_user_meta_data ->> 'full_name',
      u.raw_user_meta_data ->> 'name',
      ''
    )), '') IS NOT NULL;
