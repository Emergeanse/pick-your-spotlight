
-- Remove SELECT policy on avatars; public bucket URLs still serve files directly
DROP POLICY IF EXISTS "Public can read avatar files" ON storage.objects;

-- Revoke EXECUTE from anon/public on all security-definer helpers
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_session_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.match_movies_by_taste(extensions.vector, integer, integer[]) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.match_movies_for_recommendation(extensions.vector, integer, integer[], text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.match_movies_for_recommendation(extensions.vector, integer, integer[], text, real) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.match_movies_for_recommendation(extensions.vector, integer, integer[], text, real, text[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.match_movies_for_recommendation(extensions.vector, integer, integer[], text, real, text[], text[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.match_movies_for_recommendation(extensions.vector, integer, integer[], text, real, text[], text[], integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.match_movies_for_recommendation(extensions.vector, integer, integer[], text, real, text[], text[], integer, uuid, text, integer, integer, text[], text[]) FROM PUBLIC, anon;
