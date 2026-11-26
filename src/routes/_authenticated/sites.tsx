import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import {
  creerCompteAccueil,
  listerComptes,
  retirerCompteAccueil,
} from "@/lib/admin.functions";
import { useEspace } from "@/lib/espace";

export const Route = createFileRoute("/_authenticated/sites")({
  component: PageSites,
});

function PageSites() {
  const { siteId, siteNom, estSuperAdmin, notifier } = useEspace();
  const queryClient = useQueryClient();
  const chargerComptes = useServerFn(listerComptes);
  const nouveauCompte = useServerFn(creerCompteAccueil);
  const retirer = useServerFn(retirerCompteAccueil);
  const { data: comptes } = useQuery({
    queryKey: ["comptes", siteId],
    queryFn: () => chargerComptes({ data: { siteId: siteId as string } }),
    enabled: !!siteId && estSuperAdmin,
  });

  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  if (!estSuperAdmin) return <div className="glass empty">Réservé au Super Admin.</div>;

  async function ajouterCompte(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    if (!siteId) return;
    try {
      await nouveauCompte({ data: { siteId, email: email.trim(), motDePasse } });
      setEmail("");
      setMotDePasse("");
      notifier(
        "Compte d'accueil créé. Transmettez l'e-mail et le mot de passe à l'équipe du site.",
      );
      void queryClient.invalidateQueries({ queryKey: ["comptes", siteId] });
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Création impossible.");
    }
  }

  return (
    <>
      <section className="glass panel">
        <h2>Sites</h2>
        <p className="sub">
          Les sites sont créés dans Nova Store et déversés automatiquement ici. Choisissez un site
          dans la liste déroulante pour y attacher son livret d'accueil.
        </p>
      </section>

      {siteId && (
        <section className="glass panel">
          <h2>Comptes d'accueil · {siteNom}</h2>
          <p className="sub">
            Un e-mail d'accueil par site. Ce compte ne voit que les livrets et compléments de son
            site.
          </p>
          {comptes && comptes.length > 0 ? (
            comptes.map((c) => (
              <div key={c.userId} className="qcard">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <b>{c.email}</b>
                  <button
                    type="button"
                    className="btn small danger"
                    onClick={async () => {
                      await retirer({ data: { userId: c.userId } });
                      notifier("Compte supprimé.");
                      void queryClient.invalidateQueries({ queryKey: ["comptes", siteId] });
                    }}
                  >
                    Supprimer le compte
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="empty">Aucun compte d'accueil pour ce site.</div>
          )}
          <form className="drop" onSubmit={ajouterCompte}>
            <b>Créer le compte d'accueil du site</b>
            <div className="grid2">
              <label>
                E-mail d'accueil
                <input
                  className="field"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label>
                Mot de passe (10 caractères minimum)
                <input
                  className="field"
                  type="text"
                  required
                  minLength={10}
                  autoComplete="new-password"
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                />
              </label>
            </div>
            {erreur && <p className="err-text">{erreur}</p>}
            <div>
              <button className="btn gold" type="submit">
                Créer le compte
              </button>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
