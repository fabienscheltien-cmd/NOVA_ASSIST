import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Page d'accueil de session, prévue pour accepter plus tard un lien à usage unique venant de Nova Pass
 * (pour ne pas avoir à se reconnecter). Non implémentée : elle renvoie vers la connexion.
 */
export const Route = createFileRoute("/session")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/auth" });
  },
});
