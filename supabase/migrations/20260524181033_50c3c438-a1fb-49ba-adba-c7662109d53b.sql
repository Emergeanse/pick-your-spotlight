
REVOKE EXECUTE ON FUNCTION public.match_movies_by_taste(extensions.vector, integer, integer[]) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.match_movies_for_recommendation(extensions.vector, integer, integer[], text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.match_movies_for_recommendation(extensions.vector, integer, integer[], text, real) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.match_movies_for_recommendation(extensions.vector, integer, integer[], text, real, text[]) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.match_movies_for_recommendation(extensions.vector, integer, integer[], text, real, text[], text[]) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.match_movies_for_recommendation(extensions.vector, integer, integer[], text, real, text[], text[], integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.match_movies_for_recommendation(extensions.vector, integer, integer[], text, real, text[], text[], integer, uuid, text, integer, integer, text[], text[]) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_friend_code() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_session_code() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_friend_code() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_assign_admin() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_subscription() FROM authenticated;
