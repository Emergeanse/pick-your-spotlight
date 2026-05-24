-- Supprime les doublons de genre dans preference_tags.
-- Certains genres TV ont été insérés avec des clés différentes mais le même label
-- (ex: "Science-Fiction", "Mystère", "Comédie" existent deux fois).
-- On garde le tag avec la clé la plus courte (les originaux movie genres),
-- et on migre les user_preferences des doublons vers les canoniques.

DO $$
DECLARE
  dup_label text;
  canonical_id uuid;
  dup_id uuid;
BEGIN
  FOR dup_label IN
    SELECT label
    FROM public.preference_tags
    WHERE category = 'genre'
    GROUP BY label
    HAVING COUNT(*) > 1
  LOOP
    -- Canonical = tag avec la clé la plus courte (les genres films originaux)
    SELECT id INTO canonical_id
    FROM public.preference_tags
    WHERE category = 'genre' AND label = dup_label
    ORDER BY length(key) ASC, key ASC
    LIMIT 1;

    -- Pour chaque doublon (tous sauf le canonique)
    FOR dup_id IN
      SELECT id
      FROM public.preference_tags
      WHERE category = 'genre' AND label = dup_label AND id <> canonical_id
    LOOP
      -- Migrer les préférences utilisateur vers le tag canonique
      -- (si l'utilisateur a déjà une préférence sur le canonique, on ignore)
      UPDATE public.user_preferences AS up
      SET tag_id = canonical_id
      WHERE up.tag_id = dup_id
        AND NOT EXISTS (
          SELECT 1 FROM public.user_preferences up2
          WHERE up2.user_id = up.user_id AND up2.tag_id = canonical_id
        );

      -- Supprimer les préférences résiduelles sur le doublon
      DELETE FROM public.user_preferences WHERE tag_id = dup_id;

      -- Supprimer le tag doublon
      DELETE FROM public.preference_tags WHERE id = dup_id;
    END LOOP;
  END LOOP;
END $$;
