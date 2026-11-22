import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  creerLivret,
  listerLivrets,
  marquerErreurLivret,
  publierLivret,
  supprimerLivret,
} from "@/lib/livrets.functions";
import { analyserIncoherences, genererFiches } from "@/lib/admin.functions";
import { extraireLivret, formatDuFichier } from "@/lib/livret/extraire";
import { useEspace } from "@/lib/espace";

export const Route = createFileRoute("/_authenticated/livrets")({
  component: PageLivrets,
});

const ETAPES = [
  "Lecture du fichier",
  "Extraction du texte, des tableaux et des images",
  "Structuration par l'IA",
  "Contrôle de fidélité avec l'original",
  "Publication pour le site",
  "Fiches réflexes et alertes d'incohérences (IA)",
];

type Etat = { etape: number; erreur: string | null; bilan: string[] } | null;

const dateFr = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

function PageLivrets() {
  const { siteId, siteNom, estSuperAdmin, notifier } = useEspace();
  const queryClient = useQueryClient();
  const charger = useServerFn(listerLivrets);
  const creer = useServerFn(creerLivret);
  const publier = useServerFn(publierLivret);
  const echec = useServerFn(marquerErreurLivret);
  const supprimer = useServerFn(supprimerLivret);
  const fiches = useServerFn(genererFiches);
  const incoherences = useServerFn(analyserIncoherences);

  const { data: livrets } = useQuery({
    queryKey: ["livrets", siteId],
    queryFn: () => charger({ data: { siteId: siteId as string } }),
    enabled: !!siteId,
  });

  const [titre, setTitre] = useState("");
  const [fichier, setFichier] = useState<File | null>(null);
  const [remplace, setRemplace] = useState<{ id: string; titre: string } | null>(null);
  const [etat, setEtat] = useState<Etat>(null);
  const [aSupprimer, setASupprimer] = useState<string | null>(null);
  const champFichier = useRef<HTMLInputElement>(null);
  const formulaire = useRef<HTMLDivElement>(null);

  if (!estSuperAdmin) return <div className="glass empty">Réservé au Super Admin.</div>;
  if (!siteId)
    return (
      <div className="glass empty">
        Créez d'abord un site dans <Link to="/sites">Sites et comptes</Link>.
      </div>
    );

  const rafraichir = () => {
    void queryClient.invalidateQueries({ queryKey: ["livrets", siteId] });
    void queryClient.invalidateQueries({ queryKey: ["pages"] });
    void queryClient.invalidateQueries({ queryKey: ["fiches", siteId] });
    void queryClient.invalidateQueries({ queryKey: ["compteurs", siteId] });
    void queryClient.invalidateQueries({ queryKey: ["alertes", siteId] });
  };

  async function deposer() {
    if (!fichier || !siteId) {
      notifier("Choisissez d'abord un fichier .docx, .pdf ou .pptx.");
      return;
    }
    const format = formatDuFichier(fichier.name);
    if (!format) {
      notifier("Format non pris en charge : .docx, .pdf ou .pptx uniquement.");
      return;
    }
    if (fichier.size > 50 * 1024 * 1024) {
      notifier("Fichier trop lourd (50 Mo au maximum).");
      return;
    }
    const nom = titre.trim() || remplace?.titre || fichier.name.replace(/\.[^.]+$/, "");
    const bilan: string[] = [];
    let livretId: string | null = null;
    const avancer = (etape: number) => setEtat({ etape, erreur: null, bilan: [...bilan] });

    try {
      // 1. Lecture du fichier : fiche du livret et copie de l'original dans le stockage privé.
      avancer(0);
      const cree = await creer({ data: { siteId, titre: nom, format, fichierNom: fichier.name } });
      livretId = cree.id;
      const envoi = await supabase.storage.from("livrets").upload(cree.fichierPath, fichier, {
        contentType: fichier.type || undefined,
        upsert: true,
      });
      if (envoi.error) throw new Error("Envoi du fichier impossible.");

      // 2. Extraction dans le navigateur, puis envoi des images.
      avancer(1);
      const extraction = await extraireLivret(fichier);
      if (extraction.pages.length === 0)
        throw new Error(extraction.avertissement ?? "Aucune page lisible.");
      for (const page of extraction.pages) {
        for (const img of page.images ?? []) {
          await supabase.storage
            .from("livrets")
            .upload(
              `${cree.dossier}/${img.path}`,
              new Blob([img.data as BlobPart], { type: img.type }),
              {
                contentType: img.type,
                upsert: true,
              },
            );
        }
      }

      // 3 à 5. Structuration par l'IA, contrôle de fidélité et publication (côté serveur).
      avancer(2);
      const res = await publier({
        data: {
          livretId: cree.id,
          pages: extraction.pages.map((p) => ({
            numero: p.numero,
            titre: p.titre,
            blocs: p.blocs,
          })),
          avertissement: extraction.avertissement,
          remplace: remplace?.id ?? null,
        },
      });
      bilan.push(
        res.controle.ok
          ? `Contrôle de fidélité : 100 % du texte extrait retrouvé (${extraction.pages.length} pages).`
          : `Contrôle de fidélité : ${Math.round(res.controle.couverture * 100)} % du texte retrouvé, à vérifier : ${res.controle.manquants.slice(0, 3).join(" / ")}`,
      );
      if (res.avertissement) bilan.push(res.avertissement);
      avancer(5);
      rafraichir();

      // 6. Analyses IA complémentaires : n'empêchent pas la publication si elles échouent.
      const [f, a] = await Promise.allSettled([
        fiches({ data: { livretId: cree.id } }),
        incoherences({ data: { siteId } }),
      ]);
      bilan.push(
        f.status === "fulfilled"
          ? `${f.value.nombre} fiche(s) réflexe(s) à valider.`
          : "Fiches réflexes non générées (vous pourrez relancer depuis l'onglet Fiches réflexes).",
      );
      bilan.push(
        a.status === "fulfilled"
          ? `${a.value.nombre} alerte(s) d'incohérence ouverte(s) pour le site.`
          : "Analyse des incohérences non faite (relançable depuis l'onglet Alertes IA).",
      );
      setEtat({ etape: ETAPES.length, erreur: null, bilan });
      notifier(`Livret « ${nom} » publié pour le site ${siteNom}.`);
      setTitre("");
      setFichier(null);
      setRemplace(null);
      if (champFichier.current) champFichier.current.value = "";
      rafraichir();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Analyse impossible.";
      if (livretId) await echec({ data: { livretId, message } }).catch(() => undefined);
      setEtat((avant) => ({ etape: avant?.etape ?? 0, erreur: message, bilan }));
      rafraichir();
    }
  }

  async function confirmerSuppression(id: string) {
    await supprimer({ data: { livretId: id } });
    setASupprimer(null);
    notifier("Livret supprimé.");
    rafraichir();
  }

  const enCours = etat !== null && etat.erreur === null && etat.etape < ETAPES.length;

  return (
    <section className="glass panel">
      <h2>Livrets du site {siteNom}</h2>
      <p className="sub">
        Un site peut avoir plusieurs livrets (Accueil, Conciergerie…). Formats acceptés : Word, PDF,
        PowerPoint.
      </p>
      {livrets && livrets.length > 0 ? (
        <div className="tw">
          <table className="list">
            <thead>
              <tr>
                <th>Livret</th>
                <th>Format</th>
                <th>Pages</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {livrets.map((l) => (
                <tr key={l.id}>
                  <td>
                    <b>{l.titre}</b>
                    <br />
                    <span className="who">{l.fichier_nom}</span>
                    {l.avertissement && <div className="warnline">{l.avertissement}</div>}
                  </td>
                  <td>{l.format.toUpperCase()}</td>
                  <td>{l.nb_pages ?? "—"}</td>
                  <td>
                    {l.statut === "publie" ? (
                      <span className="status ok">● Publié</span>
                    ) : l.statut === "erreur" ? (
                      <span className="status err">● Erreur</span>
                    ) : (
                      <span className="status wait">● En analyse</span>
                    )}
                    <br />
                    <span className="who">Analysé le {dateFr(l.updated_at)}</span>
                  </td>
                  <td>
                    <div className="row">
                      <button
                        type="button"
                        className="btn small"
                        disabled={enCours}
                        onClick={() => {
                          setRemplace({ id: l.id, titre: l.titre });
                          setTitre(l.titre);
                          formulaire.current?.scrollIntoView({ behavior: "smooth" });
                        }}
                      >
                        Remplacer
                      </button>
                      {aSupprimer === l.id ? (
                        <>
                          <button
                            type="button"
                            className="btn small danger"
                            onClick={() => confirmerSuppression(l.id)}
                          >
                            Confirmer la suppression
                          </button>
                          <button
                            type="button"
                            className="btn small"
                            onClick={() => setASupprimer(null)}
                          >
                            Annuler
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="btn small danger"
                          disabled={enCours}
                          onClick={() => setASupprimer(l.id)}
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">Aucun livret pour ce site.</div>
      )}

      <div className="drop" ref={formulaire}>
        <b>{remplace ? `Remplacer le livret « ${remplace.titre} »` : "Déposer un livret"}</b>
        <label htmlFor="lt">
          Titre du livret
          <input
            className="field"
            id="lt"
            type="text"
            maxLength={120}
            placeholder="Ex. : Procédure d'accueil"
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
          />
        </label>
        <label htmlFor="lf">
          Fichier (.docx, .pdf, .pptx)
          <input
            ref={champFichier}
            className="field"
            id="lf"
            type="file"
            accept=".docx,.pdf,.pptx"
            onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
          />
        </label>
        <div className="row">
          <button type="button" className="btn gold" disabled={enCours} onClick={deposer}>
            {remplace ? "Remplacer et analyser" : "Déposer et analyser"}
          </button>
          {remplace && !enCours && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setRemplace(null);
                setTitre("");
              }}
            >
              Annuler le remplacement
            </button>
          )}
        </div>
        {etat && (
          <ul className="progress">
            {ETAPES.map((s, i) => {
              const classe =
                etat.erreur && i === etat.etape
                  ? "err"
                  : i < etat.etape
                    ? "done"
                    : i === etat.etape
                      ? "run"
                      : "";
              const marque =
                classe === "err" ? "✕" : classe === "done" ? "✓" : classe === "run" ? "…" : "○";
              return (
                <li key={s} className={classe}>
                  {marque} {s}
                </li>
              );
            })}
          </ul>
        )}
        {etat?.erreur && <p className="err-text">{etat.erreur}</p>}
        {etat && etat.bilan.length > 0 && (
          <ul className="progress">
            {etat.bilan.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
