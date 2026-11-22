import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { analyserIncoherences, listerAlertes, traiterAlerte } from "@/lib/admin.functions";
import { useEspace } from "@/lib/espace";

export const Route = createFileRoute("/_authenticated/alertes")({
  component: PageAlertes,
});

const LIBELLES: Record<string, string> = {
  contradiction: "Contradiction",
  a_completer: "À compléter",
  autre: "À vérifier",
};

function PageAlertes() {
  const { siteId, siteNom, estSuperAdmin, notifier } = useEspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const charger = useServerFn(listerAlertes);
  const analyser = useServerFn(analyserIncoherences);
  const traiter = useServerFn(traiterAlerte);
  const { data: alertes, isLoading } = useQuery({
    queryKey: ["alertes", siteId],
    queryFn: () => charger({ data: { siteId: siteId as string } }),
    enabled: !!siteId && estSuperAdmin,
  });
  const [analyse, setAnalyse] = useState(false);
  const [voirTraitees, setVoirTraitees] = useState(false);

  if (!estSuperAdmin) return <div className="glass empty">Réservé au Super Admin.</div>;
  if (!siteId) return <div className="glass empty">Aucun site sélectionné.</div>;

  const rafraichir = () => {
    void queryClient.invalidateQueries({ queryKey: ["alertes", siteId] });
    void queryClient.invalidateQueries({ queryKey: ["compteurs", siteId] });
  };

  async function relancer() {
    setAnalyse(true);
    try {
      const r = await analyser({ data: { siteId: siteId as string } });
      notifier(
        r.nombre === 0 ? "Aucune incohérence détectée." : `${r.nombre} alerte(s) détectée(s).`,
      );
      rafraichir();
    } catch (e) {
      notifier(e instanceof Error ? e.message : "Analyse impossible.");
    } finally {
      setAnalyse(false);
    }
  }

  const ouvertes = (alertes ?? []).filter((a) => a.statut === "ouverte");
  const traitees = (alertes ?? []).filter((a) => a.statut !== "ouverte");
  const liste = voirTraitees ? traitees : ouvertes;

  return (
    <section className="glass panel">
      <h2>Alertes IA · {siteNom}</h2>
      <p className="sub">
        À chaque dépôt, l'IA relit tous les livrets du site et signale les contradictions (adresse,
        horaires, prix, référents…) et les mentions « À compléter ». Rien n'est corrigé
        automatiquement : corrigez le livret d'origine puis déposez-le à nouveau, ou ajoutez un
        complément.
      </p>
      <div className="row" style={{ marginBottom: 14 }}>
        <button type="button" className="btn gold" disabled={analyse} onClick={relancer}>
          {analyse ? "Analyse en cours…" : "Relancer l'analyse"}
        </button>
        <div className="seg" role="group" aria-label="Filtre">
          <button type="button" aria-pressed={!voirTraitees} onClick={() => setVoirTraitees(false)}>
            Ouvertes ({ouvertes.length})
          </button>
          <button type="button" aria-pressed={voirTraitees} onClick={() => setVoirTraitees(true)}>
            Traitées ({traitees.length})
          </button>
        </div>
      </div>
      {isLoading ? (
        <div className="loading">Chargement…</div>
      ) : liste.length === 0 ? (
        <div className="empty">
          {voirTraitees ? "Aucune alerte traitée." : "Aucune alerte ouverte."}
        </div>
      ) : (
        liste.map((a) => (
          <div key={a.id} className="qcard">
            <span className={`alert-type ${a.type}`}>{LIBELLES[a.type] ?? a.type}</span>
            <div className="qtext">{a.titre}</div>
            <div>{a.description}</div>
            {a.sources.map((s, i) => (
              <div key={i} className="row">
                <button
                  type="button"
                  className="chip"
                  onClick={() =>
                    navigate({ to: "/detail", search: { livret: s.livret_id, page: s.page } })
                  }
                >
                  {s.livret_titre} · p. {s.page}
                </button>
                {s.extrait && <p className="extrait">« {s.extrait} »</p>}
              </div>
            ))}
            <div className="row">
              {a.statut === "ouverte" ? (
                <>
                  <button
                    type="button"
                    className="btn small"
                    onClick={async () => {
                      await traiter({ data: { alerteId: a.id, statut: "resolue" } });
                      rafraichir();
                    }}
                  >
                    Marquer comme résolue
                  </button>
                  <button
                    type="button"
                    className="btn small"
                    onClick={async () => {
                      await traiter({ data: { alerteId: a.id, statut: "ignoree" } });
                      rafraichir();
                    }}
                  >
                    Ignorer
                  </button>
                </>
              ) : (
                <>
                  <span className={`status ${a.statut === "resolue" ? "ok" : "info"}`}>
                    {a.statut === "resolue" ? "Résolue" : "Ignorée"}
                  </span>
                  <button
                    type="button"
                    className="btn small"
                    onClick={async () => {
                      await traiter({ data: { alerteId: a.id, statut: "ouverte" } });
                      rafraichir();
                    }}
                  >
                    Rouvrir
                  </button>
                </>
              )}
            </div>
          </div>
        ))
      )}
    </section>
  );
}
