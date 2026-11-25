import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { EnTete } from "@/components/EnTete";
import { supabase } from "@/integrations/supabase/client";
import { preparerConnexionStore } from "@/lib/connexion-store.functions";
import { choisirSite } from "@/lib/espace";

export const Route = createFileRoute("/connexion-store")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Connexion Nova Store | Nova Assist" },
      {
        name: "description",
        content: "Connexion sécurisée à Nova Assist depuis Nova Store.",
      },
      { property: "og:title", content: "Connexion Nova Store | Nova Assist" },
      {
        property: "og:description",
        content: "Connexion sécurisée à Nova Assist depuis Nova Store.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConnexionStore,
});

function ConnexionStore() {
  const preparer = useServerFn(preparerConnexionStore);
  const [erreur, setErreur] = useState<string | null>(null);
  const demarre = useRef(false);

  useEffect(() => {
    if (demarre.current) return;
    demarre.current = true;

    async function connecter() {
      const parametres = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const jeton = parametres.get("jeton");
      if (!jeton) {
        setErreur("Le lien de connexion Nova Store est incomplet.");
        return;
      }

      try {
        const session = await preparer({ data: { jeton } });
        const { error: erreurSortie } = await supabase.auth.signOut({ scope: "local" });
        if (erreurSortie) throw erreurSortie;

        const { error: erreurValidation } = await supabase.auth.verifyOtp({
          token_hash: session.token_hash,
          type: "magiclink",
        });
        if (erreurValidation) throw erreurValidation;

        choisirSite(session.siteId);
        window.location.replace("/");
      } catch {
        setErreur(
          "Le lien de connexion Nova Store est invalide ou expiré. Réessayez depuis Nova Store.",
        );
      }
    }

    void connecter();
  }, [preparer]);

  return (
    <>
      <EnTete />
      <div className="wrap">
        <section className="glass auth-card" aria-live="polite">
          <h2>Connexion depuis Nova Store</h2>
          {erreur ? (
            <>
              <p className="err-text" role="alert">
                {erreur}
              </p>
              <Link to="/auth" className="btn">
                Connexion par e-mail
              </Link>
            </>
          ) : (
            <p className="sub" role="status">
              Connexion à votre espace Nova Assist…
            </p>
          )}
        </section>
      </div>
    </>
  );
}
