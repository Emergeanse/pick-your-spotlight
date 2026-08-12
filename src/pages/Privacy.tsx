/**
 * /confidentialite — politique de confidentialité.
 *
 * Chaque affirmation de cette page a été vérifiée dans le code : la liste des
 * données vient de `_shared/user-data.ts`, la liste des destinataires des appels
 * réellement effectués par les fonctions serveur, et les clés de stockage
 * navigateur d'un relevé exhaustif.
 *
 * Si le comportement change, cette page doit changer avec lui. Une politique de
 * confidentialité inexacte est pire que pas de politique du tout.
 */
import LegalPage, { type LegalSection } from "@/components/pick/LegalPage";

const SECTIONS: LegalSection[] = [
  {
    title: "Ce que Pick enregistre",
    body: [
      "Pick a besoin de te connaître pour te recommander des films. Voici tout ce qui est conservé, sans exception.",
      [
        "Ton compte : adresse e-mail, mot de passe (jamais lisible — seule une empreinte chiffrée est stockée), prénom affiché, avatar, code ami, année de naissance et tranche d'âge.",
        "Tes préférences : genres aimés et exclus, plateformes de streaming, décennies, note minimale, durée maximale, type de contenu.",
        "Ton usage : films aimés, watchlist, envies, titres vus ou passés, historique des recommandations, scores calculés par film et profil de goût.",
        "Ta vie sociale sur Pick : amitiés, duos, soirées organisées ou rejointes, votes, avis, notifications, recommandations partagées.",
        "Ta voix, si tu t'en sers : l'enregistrement est transmis pour être transcrit en texte. Pick ne le conserve pas.",
      ],
      "L'année de naissance sert à écarter les contenus inadaptés à l'âge, notamment lors des soirées avec des mineurs.",
    ],
  },
  {
    title: "Pourquoi",
    body: [
      "Pour personnaliser tes recommandations, et pour rien d'autre. C'est le service lui-même : sans ces données, Pick te proposerait la même chose qu'à tout le monde.",
      "Pick ne vend aucune donnée, n'affiche aucune publicité et n'installe aucun traceur publicitaire.",
    ],
  },
  {
    title: "Qui reçoit quoi",
    body: [
      "Pick s'appuie sur quatre prestataires. Ils ne reçoivent pas les mêmes choses, et la différence compte.",
      [
        "Lovable Cloud (Supabase) — héberge l'application, la base de données et les fonctions serveur. Reçoit donc l'ensemble des données ci-dessus.",
        "Google (modèles Gemini) — reçoit tes genres préférés, tes affinités de goût, les titres des films que tu as aimés, ton indice de confiance de profil et tes exclusions. Ne reçoit ni ton adresse e-mail, ni ton nom, ni aucun identifiant de compte : le modèle ne sait pas qui tu es.",
        "ElevenLabs — reçoit l'enregistrement audio quand tu parles à Pick, et le texte que Pick doit lire à voix haute.",
        "TMDB — fournit les fiches de films. Ne reçoit que des identifiants de films, jamais de donnée personnelle.",
      ],
      "Ces prestataires appliquent leurs propres conditions et politiques de confidentialité.",
    ],
  },
  {
    title: "Ce que Pick garde dans ton navigateur",
    body: [
      "Pick n'utilise pas de cookie publicitaire. Le stockage local sert uniquement au confort d'usage :",
      [
        "ta session de connexion, pour ne pas te redemander ton mot de passe à chaque visite ;",
        "ton prénom, pour afficher le message d'accueil sans attendre le chargement ;",
        "quelques repères d'interface : visite guidée déjà vue, astuce de balayage déjà lue, soirée en cours de révélation, code de duo en attente.",
      ],
      "Se déconnecter efface la session. Vider les données du site efface le reste.",
    ],
  },
  {
    title: "Combien de temps",
    body: [
      "Tes données sont conservées tant que ton compte existe. Pick n'applique aujourd'hui aucune purge automatique au bout d'une durée donnée : tu restes maître du moment où tu effaces.",
      "Le jour où tu supprimes ton compte, l'effacement est immédiat et définitif.",
    ],
  },
  {
    title: "Tes droits, et comment les exercer",
    body: [
      "Tout se fait depuis ton profil, sans avoir à écrire à qui que ce soit.",
      [
        "Consulter et corriger — tes préférences et ton profil sont modifiables à tout moment.",
        "Emporter tes données — le bouton « Exporter mes données » télécharge un fichier contenant l'intégralité de ce que Pick détient sur toi, dans un format lisible et réutilisable.",
        "Tout effacer — le bouton « Supprimer mon compte » efface définitivement ton compte et l'ensemble de tes données. Il n'y a ni corbeille, ni délai de rétractation.",
      ],
      "Une précision importante sur la suppression : les soirées que tu as organisées disparaissent avec toi, y compris ce que les autres participants y ont laissé. Une soirée appartient à celui qui l'a créée, et un effacement annoncé comme complet ne peut pas en garder une moitié.",
    ],
  },
  {
    title: "Sécurité",
    body: [
      "Les échanges avec le serveur sont chiffrés en transit. Les règles d'accès sont appliquées côté serveur, table par table : un compte ne peut pas lire les données d'un autre en contournant l'application.",
      "Pick est en développement actif. Cette page décrit l'état réel de l'application et ne constitue ni une certification ni un audit indépendant.",
    ],
  },
  {
    title: "Nous contacter",
    body: [
      "Pour toute question sur tes données, une demande particulière ou le signalement d'une faille, écris à l'équipe Pick depuis les paramètres de l'application. Les signalements faits de bonne foi sont étudiés et ne donnent lieu à aucune poursuite.",
    ],
  },
];

const PrivacyPage = () => (
  <LegalPage
    title="Confidentialité"
    intro="Ce que Pick sait de toi, qui d'autre le voit, et comment tout reprendre ou tout effacer. Écrit pour être lu, pas pour être signé sans lire."
    updatedAt="12 août 2026"
    sections={SECTIONS}
  />
);

export default PrivacyPage;
