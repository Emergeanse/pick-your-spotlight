/**
 * useAdmin — le statut d'administrateur vient de la base, et de nulle part ailleurs.
 *
 * Une liste d'adresses e-mail était écrite en dur ici et accordait le statut par
 * simple correspondance. Deux défauts : elle révélait à quiconque lit le code
 * livré qui administre l'application, et elle plaçait la décision du côté qu'on
 * ne maîtrise pas — le navigateur.
 *
 * Ce hook ne fait de toute façon que piloter l'affichage. Les fonctions serveur
 * sensibles vérifient le rôle de leur côté (`requireAdmin`), et les politiques
 * RLS s'appuient sur `has_role`. Falsifier la réponse ici ne donnerait donc
 * accès à rien — seulement à un écran vide.
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

export function useAdmin() {
  const { user, isReady } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isReady || !user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    let annule = false;

    supabase
      .from("user_roles" as never)
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => {
        if (annule) return;
        setIsAdmin(!!data);
        setLoading(false);
      });

    return () => {
      annule = true;
    };
  }, [user, isReady]);

  return { isAdmin, loading };
}
