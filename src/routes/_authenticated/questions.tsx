import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listerQuestions,
  repondreQuestion,
  supprimerComplement,
  supprimerQuestion,
} from "@/lib/admin.functions";
import { lireComplements } from "@/lib/livrets.functions";
import { useEspace } from "@/lib/espace";

export const Route = createFileRoute("/_authenticated/questions")({
  component: PageQuestions,
});

const dateFr = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

function PageQuestions() {
  const { siteId, siteNom, estSuperAdmin, notifier } = useEspace();
  const queryClient = useQueryClient();
  const charger = useServerFn(listerQuestions);
  const chargerComplements = useServerFn(lireComplements);
  const repondre = useServerFn(repondreQuestion);
  const supprimerQ = useServerFn(supprimerQuestion);
  const supprimerC = useServerFn(supprimerComplement);
  const { data: questions, isLoading } = useQuery({
    queryKey: ["questions", siteId],
    queryFn: () => charger({ data: { siteId: siteId as string } }),
    enabled: !!siteId && estSuperAdmin,
  });
  const { data: complements } = useQuery({
    queryKey: ["complements", siteId],
    queryFn: () => chargerComplements({ data: { siteId: siteId as string } }),
    enabled: !!siteId && estSuperAdmin,
  });
  const [reponses, setReponses] = useState<Record<string, string>>({});
  const [envoi, setEnvoi] = useState<string | null>(null);

  if (!estSuperAdmin) return <div className="glass empty">Réservé au Super Admin.</div>;
  if (!siteId) return <div className="glass empty">Aucun site sélectionné.</div>;

  const rafraichir = () => {
    void queryClient.invalidateQueries({ queryKey: ["questions", siteId] });
    void queryClient.invalidateQueries({ queryKey: ["complements", siteId] });
    void queryClient.invalidateQueries({ queryKey: ["compteurs", siteId] });
  };

  async function ajouter(id: string) {
    const reponse = (reponses[id] ?? "").trim();
    if (!reponse) {
      notifier("Saisissez d'abord une réponse.");
      return;
    }
    setEnvoi(id);
    try {
      await repondre({ data: { questionId: id, reponse } });
      notifier(`Réponse ajoutée aux compléments du site ${siteNom}.`);
      rafraichir();
    } catch {
      notifier("Enregistrement impossible, réessayez.");
    } finally {
      setEnvoi(null);
    }
  }

  return (
    <>
      <section className="glass panel">
        <h2>Questions sans réponse · {siteNom}</h2>
        <p className="sub">
          Les questions auxquelles Serenity n'a pas su répondre, rattachées au site. Une réponse
          saisie ici complète Serenity pour toutes les hôtesses du site.
        </p>
        {isLoading ? (
          <div className="loading">Chargement…</div>
        ) : !questions || questions.length === 0 ? (
          <div className="empty">Aucune question en attente.</div>
        ) : (
          questions.map((q) =>
            q.statut === "traitee" ? (
              <div key={q.id} className="qcard">
                <div className="qtext">{q.question}</div>
                <div className="qmeta">
                  <span>Site {siteNom}</span>
                  <span>{dateFr(q.created_at)}</span>
                </div>
                <div className="done-note">
                  ✓ Ajoutée aux compléments : Serenity pourra maintenant y répondre.
                </div>
              </div>
            ) : (
              <div key={q.id} className="qcard">
                <div className="qtext">{q.question}</div>
                <div className="qmeta">
                  <span>Site {siteNom}</span>
                  <span>{dateFr(q.created_at)}</span>
                  <span>Réponse de Serenity : « Je ne sais pas, désolé. »</span>
                </div>
                <label className="who" htmlFor={`a-${q.id}`}>
                  Votre réponse
                </label>
                <textarea
                  className="field"
                  id={`a-${q.id}`}
                  maxLength={4000}
                  placeholder="Saisissez la réponse à ajouter au savoir de Serenity"
                  value={reponses[q.id] ?? ""}
                  onChange={(e) => setReponses((r) => ({ ...r, [q.id]: e.target.value }))}
                />
                <div className="row">
                  <button
                    type="button"
                    className="btn gold"
                    disabled={envoi === q.id}
                    onClick={() => ajouter(q.id)}
                  >
                    Ajouter aux compléments
                  </button>
                  <button
                    type="button"
                    className="btn small danger"
                    onClick={async () => {
                      await supprimerQ({ data: { questionId: q.id } });
                      rafraichir();
                    }}
                  >
                    Ignorer
                  </button>
                </div>
              </div>
            ),
          )
        )}
      </section>

      <section className="glass panel">
        <h2>Compléments du site</h2>
        <p className="sub">
          Ce que Serenity sait en plus des livrets. Le livret d'origine n'est jamais modifié.
        </p>
        {!complements || complements.length === 0 ? (
          <div className="empty">Aucun complément pour le moment.</div>
        ) : (
          complements.map((c) => (
            <div key={c.id} className="qcard">
              <div className="qtext">{c.question}</div>
              <div>{c.reponse}</div>
              <div className="row">
                <span className="who">Ajouté le {dateFr(c.created_at)}</span>
                <button
                  type="button"
                  className="btn small danger"
                  onClick={async () => {
                    await supprimerC({ data: { complementId: c.id } });
                    notifier("Complément retiré.");
                    rafraichir();
                  }}
                >
                  Retirer
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </>
  );
}
