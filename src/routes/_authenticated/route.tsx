import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listerSites, monProfil } from "@/lib/assistant.functions";
import { compteursAdmin } from "@/lib/admin.functions";
import {
  EspaceContext,
  choisirSite,
  useSiteChoisi,
  type Espace,
  type MessageChat,
} from "@/lib/espace";
import { EnTete } from "@/components/EnTete";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: Layout,
});

function Layout() {
  const queryClient = useQueryClient();
  const chargerProfil = useServerFn(monProfil);
  const chargerSites = useServerFn(listerSites);
  const chargerCompteurs = useServerFn(compteursAdmin);

  const { data: profil, isError } = useQuery({
    queryKey: ["profil"],
    queryFn: () => chargerProfil(),
  });
  const admin = profil?.estSuperAdmin === true;
  const { data: sites } = useQuery({
    queryKey: ["sites"],
    queryFn: () => chargerSites(),
    enabled: admin,
  });

  const choisi = useSiteChoisi();
  const siteAdmin = (sites ?? []).find((s) => s.id === choisi) ?? (sites ?? [])[0] ?? null;
  const siteId = admin ? (siteAdmin?.id ?? null) : (profil?.siteId ?? null);
  const siteNom = admin ? (siteAdmin?.nom ?? null) : (profil?.siteNom ?? null);

  const { data: compteurs } = useQuery({
    queryKey: ["compteurs", siteId],
    queryFn: () => chargerCompteurs({ data: { siteId: siteId as string } }),
    enabled: admin && !!siteId,
    refetchInterval: 60_000,
  });

  // Une conversation par site, conservée quand on change d'onglet.
  const [conversations, setConversations] = useState<Record<string, MessageChat[]>>({});
  const setConversation = useCallback(
    (f: (avant: MessageChat[]) => MessageChat[]) => {
      if (!siteId) return;
      setConversations((c) => ({ ...c, [siteId]: f(c[siteId] ?? []) }));
    },
    [siteId],
  );

  const [toast, setToast] = useState<string | null>(null);
  const minuteur = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const notifier = useCallback((m: string) => {
    setToast(m);
    clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => setToast(null), 3200);
  }, []);
  useEffect(() => () => clearTimeout(minuteur.current), []);

  const espace: Espace | null = useMemo(
    () =>
      profil
        ? {
            estSuperAdmin: admin,
            email: profil.email,
            siteId,
            siteNom,
            conversation: siteId ? (conversations[siteId] ?? []) : [],
            setConversation,
            notifier,
          }
        : null,
    [profil, admin, siteId, siteNom, conversations, setConversation, notifier],
  );

  async function seDeconnecter() {
    choisirSite("");
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  const ongletProps = {
    className: "tab",
    activeProps: { "aria-selected": true },
    inactiveProps: { "aria-selected": false },
  } as const;

  return (
    <>
      <EnTete
        actions={
          <>
            {admin && (sites ?? []).length > 0 && (
              <select
                className="select"
                aria-label="Site"
                value={siteId ?? ""}
                onChange={(e) => choisirSite(e.target.value)}
              >
                {(sites ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    Site {s.nom}
                  </option>
                ))}
              </select>
            )}
            <button type="button" className="navlink" onClick={seDeconnecter} title={profil?.email}>
              Déconnexion
            </button>
          </>
        }
      />
      <div className="wrap">
        <p className="site-line">
          {siteNom ? `Livret d'accueil du site ${siteNom}` : "Livret d'accueil"}
          {admin ? " · Super Admin" : ""}
        </p>

        <nav className="tabs" aria-label="Sections">
          <Link to="/" activeOptions={{ exact: true }} {...ongletProps}>
            Serenity
          </Link>
          <Link to="/detail" {...ongletProps}>
            Détail
          </Link>
          {admin && (
            <>
              <Link to="/livrets" {...ongletProps}>
                Livrets
              </Link>
              <Link to="/questions" {...ongletProps}>
                Questions sans réponse
                {!!compteurs?.questions && <span className="badge">{compteurs.questions}</span>}
              </Link>
              <Link to="/alertes" {...ongletProps}>
                Alertes IA
                {!!compteurs?.alertes && <span className="badge">{compteurs.alertes}</span>}
              </Link>
              <Link to="/fiches" {...ongletProps}>
                Fiches réflexes
                {!!compteurs?.fiches && <span className="badge">{compteurs.fiches}</span>}
              </Link>
              <Link to="/sites" {...ongletProps}>
                Sites et comptes
              </Link>
            </>
          )}
        </nav>

        <main>
          {isError ? (
            <div className="glass empty">
              Impossible de charger votre compte. Rechargez la page.
            </div>
          ) : !espace ? (
            <div className="loading">Chargement…</div>
          ) : !siteId && !admin ? (
            <div className="glass empty">
              Votre compte n'est rattaché à aucun site. Contactez l'administratrice NOVA.
            </div>
          ) : (
            <EspaceContext.Provider value={espace}>
              <Outlet />
            </EspaceContext.Provider>
          )}
        </main>
        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}
      </div>
    </>
  );
}
