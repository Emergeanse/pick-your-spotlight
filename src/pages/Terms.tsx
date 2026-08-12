/**
 * /conditions — conditions générales d'utilisation.
 *
 * Rédigées à partir de l'état réel du service (alpha, gratuit, sans paiement).
 * Plusieurs choix y sont figés — âge minimum, droit applicable, absence de
 * garantie — et méritent une relecture juridique avant toute ouverture au
 * public. Voir le commentaire de tête de Privacy.tsx sur le même sujet.
 */
import LegalPage, { type LegalSection } from "@/components/pick/LegalPage";

const SECTIONS: LegalSection[] = [
  {
    title: "Ce qu'est Pick",
    body: [
      "Pick est un service de recommandation de films et de séries. Il apprend tes goûts pour te proposer quoi regarder, seul, à deux ou en groupe.",
      "Pick ne diffuse aucun film. Il indique où les trouver et renvoie vers les plateformes de streaming, avec lesquelles il n'a aucun lien commercial.",
      "Utiliser Pick vaut acceptation des présentes conditions.",
    ],
  },
  {
    title: "Ton compte",
    body: [
      "L'accès nécessite un compte, créé avec une adresse e-mail valide.",
      [
        "Tu es responsable de ton mot de passe et de ce qui se passe sous ton compte.",
        "Un compte est personnel. Il n'est pas prévu pour être partagé.",
        "Les informations que tu déclares — notamment ton année de naissance — doivent être exactes : elles servent à écarter les contenus inadaptés lors des soirées.",
      ],
      "Pick s'adresse aux personnes de 15 ans ou plus. En dessous de cet âge, l'inscription requiert l'accord d'un parent ou du titulaire de l'autorité parentale.",
    ],
  },
  {
    title: "Ce que tu peux faire, et ce que tu ne peux pas",
    body: [
      "Pick est fait pour choisir des films. Tout le reste est hors sujet :",
      [
        "ne pas tenter d'accéder aux données d'autres utilisateurs, ni de contourner les règles d'accès ;",
        "ne pas soumettre le service à une charge automatisée ou disproportionnée ;",
        "ne pas se servir des fonctions sociales — soirées, duos, invitations — pour harceler ou importuner ;",
        "ne pas extraire massivement le contenu du service pour le réutiliser ailleurs.",
      ],
      "Un compte qui ne respecte pas ces règles peut être suspendu ou supprimé.",
    ],
  },
  {
    title: "Le contenu affiché",
    body: [
      "Les fiches de films — titres, affiches, synopsis, distributions, notes — proviennent de TMDB. Pick n'en est ni l'auteur ni le garant, et ne peut corriger une information erronée à la source.",
      "Les recommandations et les textes qui les accompagnent sont produits automatiquement. Ils peuvent se tromper, mal résumer un film ou mal juger sa disponibilité. Ce sont des suggestions, pas des affirmations vérifiées.",
      "La disponibilité annoncée sur une plateforme de streaming peut être obsolète : les catalogues changent sans préavis.",
    ],
  },
  {
    title: "Pick+ et gratuité",
    body: [
      "Pendant la phase actuelle de développement, l'intégralité des fonctionnalités est accessible gratuitement, y compris celles présentées comme Pick+. Aucun paiement n'est demandé et aucun moyen de paiement n'est collecté.",
      "Certaines fonctions annoncées dans l'interface ne sont pas encore livrées. Leur présentation ne vaut pas engagement de les livrer.",
      "Si une offre payante est introduite un jour, elle sera annoncée à l'avance et n'aura pas d'effet rétroactif sur les comptes existants.",
    ],
  },
  {
    title: "Disponibilité du service",
    body: [
      "Pick est en développement actif. Le service peut être interrompu, modifié ou remis à zéro sans préavis, et certaines fonctions peuvent disparaître.",
      "Aucune garantie de disponibilité, d'exactitude ou de conservation des données n'est donnée à ce stade. Si tes données comptent pour toi, exporte-les régulièrement depuis ton profil.",
    ],
  },
  {
    title: "Responsabilité",
    body: [
      "Pick est fourni en l'état. La responsabilité de l'éditeur ne peut être engagée pour un choix de film décevant, une information de disponibilité erronée, une interruption du service ou une perte de données.",
      "Rien dans ces conditions n'écarte les droits que la loi te reconnaît en tant que consommateur, ni les responsabilités qui ne peuvent légalement être exclues.",
    ],
  },
  {
    title: "Arrêter quand tu veux",
    body: [
      "Tu peux supprimer ton compte à tout moment depuis ton profil, sans justification et sans avoir à le demander. L'effacement est immédiat et définitif.",
      "L'éditeur peut de son côté fermer un compte en cas de manquement aux présentes conditions.",
    ],
  },
  {
    title: "Évolution des conditions",
    body: [
      "Ces conditions peuvent être modifiées. La date de dernière mise à jour figure en tête de page. Continuer à utiliser Pick après une modification vaut acceptation de la nouvelle version.",
    ],
  },
  {
    title: "Droit applicable",
    body: [
      "Ces conditions sont régies par le droit français. En cas de litige, une solution amiable sera recherchée en priorité.",
    ],
  },
];

const TermsPage = () => (
  <LegalPage
    title="Conditions d'utilisation"
    intro="Ce que Pick s'engage à faire, ce qu'il ne garantit pas, et ce qu'on attend de toi. Écrit court et en français courant."
    updatedAt="12 août 2026"
    sections={SECTIONS}
  />
);

export default TermsPage;
