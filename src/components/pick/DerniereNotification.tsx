import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getNotificationIcon, getNotificationRoute } from "@/lib/notification-navigation";
import { isPersistedNotificationId } from "@/lib/friend-notifications";
import { notificationsStore, useNotificationsStore } from "@/lib/notifications-store";

/**
 * La dernière notification reçue, sur l'accueil : invitation à une soirée,
 * film choisi, demande d'ami… Un appui l'ouvre ; « Tout voir » déplie le
 * panneau de la cloche avec les précédentes.
 *
 * Remplace la carte « Partagé avec vous » du 14 juin, qui affichait à tout le
 * monde une fausse recommandation de « Sophie ». Rien ne s'affiche tant que le
 * compte n'a reçu aucune notification.
 */
const DerniereNotification = ({ className }: { className: string }) => {
  const navigate = useNavigate();
  const { notifications } = useNotificationsStore();
  const derniere = notifications[0];
  if (!derniere) return null;

  const ouvrir = async () => {
    if (!derniere.read && isPersistedNotificationId(derniere.id)) {
      await supabase.from("notifications").update({ read: true } as never).eq("id", derniere.id);
    }
    navigate(getNotificationRoute(derniere.type, derniere.data));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, ease: [0.2, 0.8, 0.2, 1] }}
      className={`mx-5 mt-3 flex items-center gap-3 px-3 py-2 ${className}`}
    >
      <button type="button" onClick={ouvrir} className="flex-1 min-w-0 flex items-center gap-3 text-left">
        <span className="relative w-9 h-9 shrink-0 rounded-full bg-primary/15 border border-pick-border flex items-center justify-center text-[16px]" aria-hidden="true">
          {getNotificationIcon(derniere.type)}
          {!derniere.read && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-background" />}
        </span>
        <span className="flex-1 min-w-0">
          <span className={`block text-[14px] font-sans leading-tight truncate ${derniere.read ? "font-medium text-foreground/85" : "font-semibold text-foreground"}`}>
            {derniere.title}
          </span>
          <span className="mt-0.5 flex items-baseline gap-1.5 min-w-0 text-[12px] font-sans leading-tight">
            {derniere.body && <span className="truncate text-pick-text-secondary">{derniere.body}</span>}
            <span className="shrink-0 text-[11px] text-pick-text-muted">
              {derniere.body ? "· " : ""}{formatDistanceToNow(new Date(derniere.created_at), { addSuffix: true, locale: fr })}
            </span>
          </span>
        </span>
      </button>
      {notifications.length > 1 ? (
        <button
          type="button"
          onClick={() => notificationsStore.ouvrirPanneau()}
          className="shrink-0 px-3 py-1.5 rounded-full border border-pick-border-hover text-[12px] font-sans font-semibold text-pick-purple-light"
        >
          Tout voir
        </button>
      ) : (
        <ChevronRight className="w-4 h-4 text-pick-text-muted shrink-0" aria-hidden="true" />
      )}
    </motion.div>
  );
};

export default DerniereNotification;
