-- Retire le genre UI composite « Sci-Fi & Fantastique » (et variantes),
-- qui doublonne « Science-Fiction » + « Fantastique ».
-- Les équivalents TV restent utilisés côté matching SQL (surprise-personalized),
-- mais ne doivent plus être des preference_tags sélectionnables.

DO $$
DECLARE
  composite_labels constant text[] := ARRAY[
    'Sci-Fi & Fantastique',
    'Science-Fiction & Fantastique',
    'Sci-Fi & Fantasy'
  ];
  sf_id uuid;
  fant_id uuid;
  composite_ids uuid[];
  rec record;
BEGIN
  SELECT id INTO sf_id
  FROM public.preference_tags
  WHERE category = 'genre' AND key = 'science-fiction'
  LIMIT 1;

  SELECT id INTO fant_id
  FROM public.preference_tags
  WHERE category = 'genre' AND key = 'fantastique'
  LIMIT 1;

  SELECT COALESCE(array_agg(id), '{}'::uuid[])
  INTO composite_ids
  FROM public.preference_tags
  WHERE category = 'genre'
    AND (
      label = ANY (composite_labels)
      OR key IN (
        'sci-fi-fantastique',
        'science-fiction-fantastique',
        'sci-fi-fantasy',
        'science-fiction-and-fantastique',
        'scifi-fantastique'
      )
    );

  IF cardinality(composite_ids) = 0 THEN
    RAISE NOTICE 'Aucun tag composite Sci-Fi/Fantastique à retirer';
  ELSE
    -- Si un user aimait le composite, propager vers Science-Fiction + Fantastique
    -- (sans écraser une exclusion déjà explicite sur le tag canonique).
    FOR rec IN
      SELECT up.user_id, up.weight, up.source
      FROM public.user_preferences up
      WHERE up.tag_id = ANY (composite_ids)
        AND up.weight > 0
    LOOP
      IF sf_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.user_preferences up2
        WHERE up2.user_id = rec.user_id AND up2.tag_id = sf_id
      ) THEN
        INSERT INTO public.user_preferences (user_id, tag_id, weight, source)
        VALUES (rec.user_id, sf_id, rec.weight, rec.source);
      END IF;

      IF fant_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.user_preferences up2
        WHERE up2.user_id = rec.user_id AND up2.tag_id = fant_id
      ) THEN
        INSERT INTO public.user_preferences (user_id, tag_id, weight, source)
        VALUES (rec.user_id, fant_id, rec.weight, rec.source);
      END IF;
    END LOOP;

    DELETE FROM public.user_preferences WHERE tag_id = ANY (composite_ids);
    DELETE FROM public.preference_tags WHERE id = ANY (composite_ids);
  END IF;

  -- Nettoyer les tableaux legacy sur profiles
  UPDATE public.profiles
  SET
    favorite_genres = COALESCE((
      SELECT array_agg(g ORDER BY ordinality)
      FROM unnest(COALESCE(favorite_genres, '{}'::text[])) WITH ORDINALITY AS t(g, ordinality)
      WHERE g <> ALL (composite_labels)
    ), '{}'::text[]),
    excluded_genres = COALESCE((
      SELECT array_agg(g ORDER BY ordinality)
      FROM unnest(COALESCE(excluded_genres, '{}'::text[])) WITH ORDINALITY AS t(g, ordinality)
      WHERE g <> ALL (composite_labels)
    ), '{}'::text[])
  WHERE favorite_genres && composite_labels
     OR excluded_genres && composite_labels;

  -- Nettoyer les tags de soirée éventuels
  UPDATE public.events
  SET genre_tags = COALESCE((
    SELECT array_agg(g ORDER BY ordinality)
    FROM unnest(COALESCE(genre_tags, '{}'::text[])) WITH ORDINALITY AS t(g, ordinality)
    WHERE g <> ALL (composite_labels)
  ), '{}'::text[])
  WHERE genre_tags && composite_labels;
END $$;
