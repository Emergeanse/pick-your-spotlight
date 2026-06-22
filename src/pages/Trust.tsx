/**
 * /trust — Trust & Privacy surface page.
 *
 * App-owned editable content. Describes the security, privacy, and data-handling
 * posture visible from Pick today. This page is maintained by the Pick team and
 * is not an independent audit or certification.
 */
import { motion } from "framer-motion";
import { ArrowLeft, ShieldCheck, Lock, Database, Server, Users, Cookie, Mail, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";

const SECTIONS: Array<{
  icon: typeof ShieldCheck;
  title: string;
  body: string;
}> = [
  {
    icon: Lock,
    title: "Authentification & accès",
    body:
      "L'accès à Pick nécessite un compte. Les sessions sont stockées de manière sécurisée par le backend et seules les données rattachées à ton compte te sont visibles dans l'application. Les règles d'accès sont appliquées côté serveur sur toutes les tables exposées.",
  },
  {
    icon: Server,
    title: "Hébergement & infrastructure",
    body:
      "Pick s'appuie sur Lovable Cloud pour l'hébergement applicatif, la base de données et les fonctions serveur. Les communications avec le backend sont chiffrées en transit (HTTPS).",
  },
  {
    icon: Database,
    title: "Données collectées",
    body:
      "Pick stocke uniquement les informations nécessaires au service : adresse e-mail du compte, préférences cinéma (genres, plateformes), watchlist, films likés, historique de recommandations et profil de goût. Ces données servent à personnaliser tes recommandations.",
  },
  {
    icon: Users,
    title: "Sous-traitants & intégrations",
    body:
      "Pick utilise TMDB pour les métadonnées de films, Lovable Cloud pour le backend, Lovable AI pour les recommandations conversationnelles, et ElevenLabs pour la synthèse vocale de Pick. Aucune donnée personnelle n'est revendue.",
  },
  {
    icon: Cookie,
    title: "Cookies & analyse",
    body:
      "Pick utilise uniquement le stockage local strictement nécessaire à l'authentification et au fonctionnement de l'application (préférences, session). Aucun cookie publicitaire n'est posé.",
  },
  {
    icon: FileText,
    title: "Conservation & suppression",
    body:
      "Tu peux à tout moment consulter et mettre à jour tes préférences depuis ton profil. Pour demander la suppression de ton compte et des données associées, contacte l'équipe Pick via les paramètres de l'application.",
  },
  {
    icon: Mail,
    title: "Signalement & contact sécurité",
    body:
      "Pour toute question relative à la sécurité, à la confidentialité ou au signalement d'une vulnérabilité, contacte l'équipe Pick via les paramètres de l'application. Nous étudions toutes les remontées de bonne foi.",
  },
];

const TrustPage = () => {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 bg-background overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/10 px-5 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-foreground/60 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="font-serif text-lg">Confiance & confidentialité</span>
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-8 pb-24">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/25 flex items-center justify-center mx-auto mb-5">
            <ShieldCheck className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-serif text-foreground mb-3">Confiance & confidentialité</h1>
          <p className="text-foreground/55 text-sm font-sans leading-relaxed max-w-md mx-auto">
            Cette page est maintenue par l'équipe Pick pour répondre aux questions courantes sur la sécurité, la confidentialité et les données de l'application.
          </p>
        </motion.div>

        {/* Sections */}
        <div className="space-y-3 mb-10">
          {SECTIONS.map((s, i) => (
            <motion.section
              key={s.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + i * 0.04 }}
              className="rounded-2xl border border-border/15 bg-card/40 px-5 py-4"
            >
              <div className="flex items-start gap-3">
                <div className="shrink-0 w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mt-0.5">
                  <s.icon className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-serif text-foreground mb-1">{s.title}</h2>
                  <p className="text-sm font-sans text-foreground/65 leading-relaxed">{s.body}</p>
                </div>
              </div>
            </motion.section>
          ))}
        </div>

        {/* Shared responsibility & qualifiers */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl border border-border/10 bg-card/30 px-5 py-4 space-y-3"
        >
          <h3 className="text-sm font-serif text-foreground/80">Responsabilités partagées</h3>
          <p className="text-xs font-sans text-foreground/55 leading-relaxed">
            Les capacités décrites ci-dessus reposent à la fois sur les fonctions de la plateforme Lovable Cloud et sur les choix d'exploitation de l'équipe Pick. Cette page décrit l'état actuel de l'application et n'engage aucune certification indépendante ni conformité réglementaire.
          </p>
          <p className="text-[11px] font-sans text-foreground/40 leading-relaxed">
            Cette page n'est pas une certification. Elle est mise à jour par l'équipe Pick au fil des évolutions de l'application.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default TrustPage;
