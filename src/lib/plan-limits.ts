/**
 * Les plafonds tels qu'on les annonce à l'utilisateur.
 *
 * ⚠️ Ce fichier ne DÉCIDE de rien. Les plafonds qui s'appliquent vraiment vivent
 * dans la table `plan_quotas`, et c'est le serveur qui les fait respecter. Ceci
 * n'est que ce qu'on affiche — sur la page d'accueil publique notamment, qui
 * n'a aucun utilisateur connecté pour interroger la base.
 *
 * En modifiant `plan_quotas`, modifier ces chiffres dans la foulée. Une
 * promesse d'interface qui ne correspond plus au comportement réel est
 * exactement ce que le point 09 de la feuille de route corrigeait.
 *
 * Dans l'application connectée, préférer `usePickPlus().serverQuotas`, qui lit
 * les vraies valeurs.
 */

export const PLAN_LIMITS = {
  free: {
    recommendation: 3,
    chat: 5,
    voice: 5,
  },
  pickPlus: {
    recommendation: 40,
    chat: 100,
    voice: 60,
  },
} as const;
