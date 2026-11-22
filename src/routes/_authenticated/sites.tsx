import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import {
  creerCompteAccueil,
  creerSite,
  listerComptes,
  retirerCompteAccueil,
} from "@/lib/admin.functions";
import { choisirSite, useEspace } from "@/lib/espace";

export const Route = createFileRoute("/_authenticated/sites")({
  component: PageSites,
});

function PageSites() {
  const { siteId, siteNom, estSuperAdmin, notifier } = useEspace();
  const queryClient = useQueryClient();
  const nouveauSite = useServerFn(creerSite);
  const chargerComptes = useServerFn(listerComptes);
  const nouveauCompte = useServerFn(creerCompteAccueil);
  const retirer = useServerFn(retirerCompteAccueil);
  const { data: comptes } = useQuery({
    queryKey: ["comptes", siteId],
    queryFn: () => chargerComptes({ data: { siteId: siteId as string } }),
    enabled: !!siteId && estSuperAdmin,
  });

  const [nom, setNom] = useState("");
  const [ville, setVille] = useState("");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  if (!estSuperAdmin) return <div className="glass empty">Réservé au Super Admin.</div>;

  async function ajouterSite(e: FormEvent) {
    e.preventDefault();
    if (!nom.trim()) return;
    const s = await nouveauSite({ data: { nom: nom.trim(), ville: ville.trim() || null } });
    await queryClient.invalidateQueries({ queryKey: ["sites"] });
    choisirSite(s.id);
    setNom("");
    setVille("");
    notifier(`Site « ${nom.trim()} » créé.`);
  }

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
        <h2>Créer un site</h2>
        <p className="sub">Chaque site a ses propres livrets, compléments et comptes d'accueil.</p>
        <form className="grid2" onSubmit={ajouterSite}>
          <label className="who">
            Nom du site
            <input
              className="field"
              required
              maxLength={120}
              placeholder="Ex. : Seine Avenue"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
            />
          </label>
          <label className="who">
            Ville (facultatif)
            <input
              className="field"
              maxLength={120}
              placeholder="Ex. : Asnières-sur-Seine"
              value={ville}
              onChange={(e) => setVille(e.target.value)}
            />
          </label>
          <div>
            <button className="btn gold" type="submit">
              Créer le site
            </button>
          </div>
        </form>
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
