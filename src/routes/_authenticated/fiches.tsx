import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { genererFiches, modifierFiche, supprimerFiche } from "@/lib/admin.functions";
import { lireFiches, listerLivrets } from "@/lib/livrets.functions";
import { useEspace } from "@/lib/espace";

export const Route = createFileRoute("/_authenticated/fiches")({
  component: PageFiches,
});

type Fiche = {
  id: string;
  livret_id: string;
  titre: string;
  quand: string | null;
  etapes: string[];
  page: number | null;
  statut: string;
};

function PageFiches() {
  const { siteId, siteNom, estSuperAdmin, notifier } = useEspace();
  const queryClient = useQueryClient();
  const chargerLivrets = useServerFn(listerLivrets);
  const chargerFiches = useServerFn(lireFiches);
  const generer = useServerFn(genererFiches);
  const { data: livrets } = useQuery({
    queryKey: ["livrets", siteId],
    queryFn: () => chargerLivrets({ data: { siteId: siteId as string } }),
    enabled: !!siteId,
  });
  const { data: fiches, isLoading } = useQuery({
    queryKey: ["fiches", siteId],
    queryFn: () => chargerFiches({ data: { siteId: siteId as string } }),
    enabled: !!siteId,
  });
  const [generation, setGeneration] = useState<string | null>(null);

  if (!estSuperAdmin) return <div className="glass empty">Réservé au Super Admin.</div>;
  if (!siteId) return <div className="glass empty">Aucun site sélectionné.</div>;

  const rafraichir = () => {
    void queryClient.invalidateQueries({ queryKey: ["fiches", siteId] });
    void queryClient.invalidateQueries({ queryKey: ["compteurs", siteId] });
  };

  async function regenerer(livretId: string) {
    setGeneration(livretId);
    try {
      const r = await generer({ data: { livretId } });
      notifier(`${r.nombre} fiche(s) proposée(s) par l'IA.`);
      rafraichir();
    } catch (e) {
      notifier(e instanceof Error ? e.message : "Génération impossible.");
    } finally {
      setGeneration(null);
    }
  }

  const publies = (livrets ?? []).filter((l) => l.statut === "publie");

  return (
    <section className="glass panel">
      <h2>Fiches réflexes · {siteNom}</h2>
      <p className="sub">
        L'IA résume les procédures clés de chaque livret en fiches courtes. Relisez, corrigez si
        besoin, puis validez : seules les fiches validées sont visibles par l'accueil, dans l'onglet
        Détail.
      </p>
      {isLoading ? (
        <div className="loading">Chargement…</div>
      ) : publies.length === 0 ? (
        <div className="empty">Aucun livret publié pour ce site.</div>
      ) : (
        publies.map((l) => {
          const liste = (fiches ?? []).filter((f) => f.livret_id === l.id);
          return (
            <div key={l.id} style={{ marginBottom: 22 }}>
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
                <h3 style={{ fontSize: "1rem" }}>{l.titre}</h3>
                <button
                  type="button"
                  className="btn small"
                  disabled={generation !== null}
                  onClick={() => regenerer(l.id)}
                >
                  {generation === l.id ? "Génération en cours…" : "Proposer de nouvelles fiches"}
                </button>
              </div>
              {liste.length === 0 ? (
                <div className="empty">Aucune fiche pour ce livret.</div>
              ) : (
                liste.map((f) => (
                  <CarteFiche key={f.id} fiche={f} apres={rafraichir} notifier={notifier} />
                ))
              )}
            </div>
          );
        })
      )}
    </section>
  );
}

function CarteFiche({
  fiche,
  apres,
  notifier,
}: {
  fiche: Fiche;
  apres: () => void;
  notifier: (m: string) => void;
}) {
  const navigate = useNavigate();
  const modifier = useServerFn(modifierFiche);
  const supprimer = useServerFn(supprimerFiche);
  const [edition, setEdition] = useState(false);
  const [titre, setTitre] = useState(fiche.titre);
  const [quand, setQuand] = useState(fiche.quand ?? "");
  const [etapes, setEtapes] = useState(fiche.etapes.join("\n"));

  async function enregistrer(statut: "brouillon" | "validee") {
    const liste = etapes
      .split("\n")
      .map((e) => e.trim())
      .filter(Boolean);
    if (!titre.trim() || liste.length === 0) {
      notifier("Une fiche a besoin d'un titre et d'au moins une étape.");
      return;
    }
    await modifier({
      data: {
        ficheId: fiche.id,
        titre: titre.trim(),
        quand: quand.trim() || null,
        etapes: liste,
        statut,
      },
    });
    setEdition(false);
    notifier(
      statut === "validee"
        ? "Fiche validée : visible par l'accueil."
        : "Fiche repassée en brouillon.",
    );
    apres();
  }

  return (
    <article className="fiche">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className={`status ${fiche.statut === "validee" ? "ok" : "wait"}`}>
          {fiche.statut === "validee" ? "● Validée" : "● À valider"}
        </span>
        {fiche.page && (
          <button
            type="button"
            className="chip"
            onClick={() =>
              navigate({
                to: "/detail",
                search: { livret: fiche.livret_id, page: fiche.page ?? 1 },
              })
            }
          >
            Source · p. {fiche.page}
          </button>
        )}
      </div>
      {edition ? (
        <>
          <label className="who">
            Titre
            <input
              className="field"
              value={titre}
              maxLength={160}
              onChange={(e) => setTitre(e.target.value)}
            />
          </label>
          <label className="who">
            Quand l'utiliser
            <input
              className="field"
              value={quand}
              maxLength={300}
              onChange={(e) => setQuand(e.target.value)}
            />
          </label>
          <label className="who">
            Étapes (une par ligne)
            <textarea
              className="field"
              rows={6}
              value={etapes}
              onChange={(e) => setEtapes(e.target.value)}
            />
          </label>
        </>
      ) : (
        <>
          <h3>{fiche.titre}</h3>
          {fiche.quand && <p className="quand">{fiche.quand}</p>}
          <ol>
            {fiche.etapes.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ol>
          <p className="ia-note">
            Proposée par l'IA à partir du livret : vérifiez avant de valider.
          </p>
        </>
      )}
      <div className="row">
        {fiche.statut !== "validee" || edition ? (
          <button type="button" className="btn gold small" onClick={() => enregistrer("validee")}>
            Valider
          </button>
        ) : (
          <button type="button" className="btn small" onClick={() => enregistrer("brouillon")}>
            Repasser en brouillon
          </button>
        )}
        {edition ? (
          <button type="button" className="btn small" onClick={() => setEdition(false)}>
            Annuler
          </button>
        ) : (
          <button type="button" className="btn small" onClick={() => setEdition(true)}>
            Modifier
          </button>
        )}
        <button
          type="button"
          className="btn small danger"
          onClick={async () => {
            await supprimer({ data: { ficheId: fiche.id } });
            apres();
          }}
        >
          Supprimer
        </button>
      </div>
    </article>
  );
}
