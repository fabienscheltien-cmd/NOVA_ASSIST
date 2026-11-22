import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lireComplements, lireFiches, lirePages, listerLivrets } from "@/lib/livrets.functions";
import { useEspace } from "@/lib/espace";
import { BlocsPage } from "@/components/BlocsPage";

const recherche = z.object({
  livret: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
});

export const Route = createFileRoute("/_authenticated/detail")({
  validateSearch: (s) => recherche.parse(s),
  component: PageDetail,
});

function PageDetail() {
  const { siteId, notifier } = useEspace();
  const { livret: livretParam, page: pageParam } = Route.useSearch();
  const navigate = useNavigate({ from: "/detail" });

  const chargerLivrets = useServerFn(listerLivrets);
  const chargerComplements = useServerFn(lireComplements);
  const chargerFiches = useServerFn(lireFiches);
  const { data: tous, isLoading } = useQuery({
    queryKey: ["livrets", siteId],
    queryFn: () => chargerLivrets({ data: { siteId: siteId as string } }),
    enabled: !!siteId,
  });
  const { data: complements } = useQuery({
    queryKey: ["complements", siteId],
    queryFn: () => chargerComplements({ data: { siteId: siteId as string } }),
    enabled: !!siteId,
  });
  const { data: fiches } = useQuery({
    queryKey: ["fiches", siteId],
    queryFn: () => chargerFiches({ data: { siteId: siteId as string } }),
    enabled: !!siteId,
  });
  const livrets = (tous ?? []).filter((l) => l.statut === "publie");
  const fichesValidees = (fiches ?? []).filter((f) => f.statut === "validee");

  const choix = livretParam ?? livrets[0]?.id ?? "complements";
  const livret = livrets.find((l) => l.id === choix) ?? null;
  const page = pageParam ?? 1;

  if (!siteId) return <div className="glass empty">Aucun site sélectionné.</div>;
  if (isLoading) return <div className="loading">Chargement des livrets…</div>;

  const pills = (
    <div className="pills">
      {livrets.map((l) => (
        <button
          key={l.id}
          type="button"
          className="pill"
          aria-pressed={choix === l.id}
          onClick={() => navigate({ search: { livret: l.id, page: 1 } })}
        >
          {l.titre} · {l.nb_pages ?? 0} pages
        </button>
      ))}
      {fichesValidees.length > 0 && (
        <button
          type="button"
          className="pill"
          aria-pressed={choix === "fiches"}
          onClick={() => navigate({ search: { livret: "fiches" } })}
        >
          Fiches réflexes ({fichesValidees.length})
        </button>
      )}
      <button
        type="button"
        className="pill"
        aria-pressed={choix === "complements"}
        onClick={() => navigate({ search: { livret: "complements" } })}
      >
        Compléments ({complements?.length ?? 0})
      </button>
    </div>
  );

  if (choix === "complements") {
    return (
      <>
        {pills}
        <div className="sheet" style={{ marginTop: 16 }}>
          <h2>Compléments</h2>
          <p className="sub">
            Réponses ajoutées par le Super Admin aux questions restées sans réponse. Le livret
            d'origine n'est jamais modifié.
          </p>
          {complements && complements.length > 0 ? (
            <div className="compl">
              {complements.map((c) => (
                <article key={c.id}>
                  <b>{c.question}</b>
                  <br />
                  {c.reponse}
                </article>
              ))}
            </div>
          ) : (
            <div className="placeholder">Aucun complément pour le moment.</div>
          )}
        </div>
      </>
    );
  }

  if (choix === "fiches") {
    const titreLivret = (id: string) => livrets.find((l) => l.id === id)?.titre ?? "Livret";
    return (
      <>
        {pills}
        <div className="sheet fiches-sheet" style={{ marginTop: 16 }}>
          <h2>Fiches réflexes</h2>
          <p className="sub">
            Résumés des procédures clés, préparés par l'IA à partir des livrets et validés par
            l'administratrice. En cas de doute, le livret fait foi.
          </p>
          {fichesValidees.map((f) => (
            <article key={f.id} className="fiche">
              <h3>{f.titre}</h3>
              {f.quand && <p className="quand">{f.quand}</p>}
              <ol>
                {f.etapes.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ol>
              <div>
                <button
                  type="button"
                  className="btn small"
                  onClick={() => navigate({ search: { livret: f.livret_id, page: f.page ?? 1 } })}
                >
                  {titreLivret(f.livret_id)}
                  {f.page ? ` · p. ${f.page}` : ""}
                </button>
              </div>
            </article>
          ))}
        </div>
      </>
    );
  }

  if (!livret) {
    return (
      <>
        {pills}
        <div className="glass empty" style={{ marginTop: 16 }}>
          {livrets.length === 0
            ? "Aucun livret n'a encore été déposé pour ce site."
            : "Ce livret n'est plus disponible."}
        </div>
      </>
    );
  }

  return (
    <>
      {pills}
      <LivretDetail
        key={livret.id}
        livret={livret}
        page={page}
        allerA={(p) => navigate({ search: { livret: livret.id, page: p } })}
        notifier={notifier}
      />
    </>
  );
}

type LivretResume = {
  id: string;
  titre: string;
  fichier_nom: string;
  fichier_path: string;
  nb_pages: number | null;
  avertissement: string | null;
};

function LivretDetail({
  livret,
  page,
  allerA,
  notifier,
}: {
  livret: LivretResume;
  page: number;
  allerA: (p: number) => void;
  notifier: (m: string) => void;
}) {
  const chargerPages = useServerFn(lirePages);
  const { data: pages, isLoading } = useQuery({
    queryKey: ["pages", livret.id],
    queryFn: () => chargerPages({ data: { livretId: livret.id } }),
  });
  const dossier = livret.fichier_path.split("/").slice(0, 2).join("/");
  const courante = (pages ?? []).find((p) => p.numero === page) ?? (pages ?? [])[0];
  const total = pages?.length ?? livret.nb_pages ?? 0;

  // Images de la page courante : liens signés temporaires (bucket privé).
  const [images, setImages] = useState<Record<string, string>>({});
  useEffect(() => {
    const chemins = (courante?.blocs ?? []).flatMap((b) => (b.t === "image" ? [b.path] : []));
    if (chemins.length === 0) return;
    let actif = true;
    void supabase.storage
      .from("livrets")
      .createSignedUrls(
        chemins.map((c) => `${dossier}/${c}`),
        3600,
      )
      .then(({ data }) => {
        if (!actif || !data) return;
        const res: Record<string, string> = {};
        data.forEach((d, i) => {
          const c = chemins[i];
          if (c && d.signedUrl) res[c] = d.signedUrl;
        });
        setImages((avant) => ({ ...avant, ...res }));
      });
    return () => {
      actif = false;
    };
  }, [courante, dossier]);

  async function telecharger() {
    const { data, error } = await supabase.storage
      .from("livrets")
      .createSignedUrl(livret.fichier_path, 120, { download: livret.fichier_nom });
    if (error || !data) notifier("Téléchargement impossible pour le moment.");
    else window.location.href = data.signedUrl;
  }

  if (isLoading) return <div className="loading">Chargement des pages…</div>;
  if (!courante) return <div className="glass empty">Ce livret ne contient aucune page.</div>;

  return (
    <div className="detail" style={{ marginTop: 16 }}>
      <aside className="glass toc">
        <h3>Sommaire</h3>
        {(pages ?? []).map((p) => (
          <button
            key={p.numero}
            type="button"
            aria-current={p.numero === courante.numero ? "true" : undefined}
            onClick={() => allerA(p.numero)}
          >
            <span className="n">{p.numero}</span>
            <span>{p.titre ?? `Page ${p.numero}`}</span>
          </button>
        ))}
      </aside>
      <article className="sheet">
        <div className="sheet-bar">
          <span>
            {livret.titre} · page {courante.numero} sur {total} · {livret.fichier_nom}
          </span>
          <button type="button" className="btn small" onClick={telecharger}>
            Télécharger l'original
          </button>
        </div>
        <h2>{courante.titre ?? `Page ${courante.numero}`}</h2>
        <p className="sub">
          {livret.titre} · page {courante.numero}
        </p>
        {courante.blocs.length === 0 ? (
          <div className="placeholder">
            Cette page ne contient pas de texte lisible. Consultez l'original.
          </div>
        ) : (
          <BlocsPage blocs={courante.blocs} images={images} />
        )}
        <div className="pager">
          <button
            type="button"
            className="btn small"
            disabled={courante.numero <= 1}
            onClick={() => allerA(courante.numero - 1)}
          >
            ← Page précédente
          </button>
          <button
            type="button"
            className="btn small"
            disabled={courante.numero >= total}
            onClick={() => allerA(courante.numero + 1)}
          >
            Page suivante →
          </button>
        </div>
      </article>
    </div>
  );
}
