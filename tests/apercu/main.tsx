import { createRoot } from "react-dom/client";
import { useState } from "react";
import "@/styles.css";
import { EnTete } from "@/components/EnTete";
import serenity from "@/assets/serenity_full.jpg";
import avatar from "@/assets/serenity_avatar.jpg";
import { BlocsPage } from "@/components/BlocsPage";
import { Texte } from "@/components/Texte";
import { blocsDepuisJson } from "@/lib/livret/blocs";
import pages from "./pages.json";

type Page = { numero: number; titre: string | null; blocs: unknown[] };
const LIVRETS: Record<string, { titre: string; fichier: string; pages: Page[] }> = {
  accueil: {
    titre: "Livret Accueil",
    fichier: "Procédure_SA.pptx",
    pages: pages.accueil as Page[],
  },
  conciergerie: {
    titre: "Livret Conciergerie",
    fichier: "Livret_Procedures_Conciergerie_NOVA.pptx",
    pages: pages.conciergerie as Page[],
  },
};

function Apercu() {
  const vue = new URLSearchParams(location.search).get("vue") ?? "serenity";
  const [livret, setLivret] = useState(
    new URLSearchParams(location.search).get("livret") ?? "accueil",
  );
  const [page, setPage] = useState(Number(new URLSearchParams(location.search).get("page") ?? 12));
  const L = LIVRETS[livret]!;
  const courante = L.pages.find((p) => p.numero === page) ?? L.pages[0]!;
  const images = Object.fromEntries(
    courante.blocs.flatMap((b) => {
      const bloc = b as { t: string; path?: string };
      return bloc.t === "image" && bloc.path ? [[bloc.path, avatar]] : [];
    }),
  );
  const onglet = (id: string, libelle: string, badge?: number) => (
    <a className="tab" aria-selected={vue === id} href={`?vue=${id}`}>
      {libelle}
      {badge ? <span className="badge">{badge}</span> : null}
    </a>
  );
  return (
    <>
      <EnTete
        actions={
          <>
            <select className="select" aria-label="Site">
              <option>Site Seine Avenue</option>
            </select>
            <button type="button" className="navlink">
              Déconnexion
            </button>
          </>
        }
      />
      <div className="wrap">
        <p className="site-line">Livret d'accueil du site Seine Avenue · Super Admin</p>
        <nav className="tabs">
          {onglet("serenity", "Serenity")}
          {onglet("detail", "Détail")}
          {onglet("livrets", "Livrets")}
          {onglet("questions", "Questions sans réponse", 1)}
          {onglet("alertes", "Alertes IA", 2)}
          {onglet("fiches", "Fiches réflexes", 5)}
          {onglet("sites", "Sites et comptes")}
        </nav>
        <main>
          {vue === "serenity" && (
            <div className="chat-layout">
              <section className="glass chat">
                <div className="chat-head">
                  <span>
                    <b>Site Seine Avenue</b> · 2 livrets
                  </span>
                  <span>Réponses fondées sur les livrets</span>
                </div>
                <div className="msgs">
                  <div className="bubble user">
                    Que faire si un livreur dépose un colis à l'accueil ?
                  </div>
                  <div className="bubble bot">
                    <Texte
                      texte={
                        "Aucun colis ne doit être conservé à l'accueil, et l'accueil ne signe pas les livraisons, sauf autorisation.\n- Les livreurs se rendent directement dans les étages concernés.\n- Colis coworking : consultez l'annuaire du coworking, contactez la personne concernée, puis **Eli**, responsable du coworking, si personne ne répond."
                      }
                    />
                    <div className="src">
                      <button type="button" className="chip">
                        Livret Accueil · p. 12
                      </button>
                    </div>
                  </div>
                  <div className="bubble user">Quel est le code du wifi visiteurs ?</div>
                  <div className="bubble bot unknown">
                    <Texte texte="Je ne sais pas, désolé." />
                  </div>
                </div>
                <form className="composer" onSubmit={(e) => e.preventDefault()}>
                  <input placeholder="Ex. : Quel est le prix d'une chemise ?" />
                  <button className="btn gold" type="submit">
                    Envoyer
                  </button>
                </form>
                <div className="hint">
                  Serenity répond uniquement d'après les livrets du site. Si elle ne sait pas, la
                  question est transmise à l'administratrice.
                </div>
              </section>
              <aside className="serenity">
                <div className="greet">
                  <strong>Bonjour, je suis Serenity !</strong> Posez-moi votre question sur nos
                  hôtes et hôtesses d'accueil, la conciergerie, le courrier, les colis ou nos
                  tarifs.
                </div>
                <img className="face" src={serenity} alt="Serenity" />
              </aside>
            </div>
          )}
          {vue === "detail" && (
            <>
              <div className="pills">
                {Object.entries(LIVRETS).map(([k, l]) => (
                  <button
                    key={k}
                    type="button"
                    className="pill"
                    aria-pressed={livret === k}
                    onClick={() => {
                      setLivret(k);
                      setPage(1);
                    }}
                  >
                    {l.titre} · {l.pages.length} pages
                  </button>
                ))}
                <button type="button" className="pill">
                  Fiches réflexes (5)
                </button>
                <button type="button" className="pill">
                  Compléments (1)
                </button>
              </div>
              <div className="detail" style={{ marginTop: 16 }}>
                <aside className="glass toc">
                  <h3>Sommaire</h3>
                  {L.pages.map((p) => (
                    <button
                      key={p.numero}
                      type="button"
                      aria-current={p.numero === courante.numero ? "true" : undefined}
                      onClick={() => setPage(p.numero)}
                    >
                      <span className="n">{p.numero}</span>
                      <span>{p.titre ?? `Page ${p.numero}`}</span>
                    </button>
                  ))}
                </aside>
                <article className="sheet">
                  <div className="sheet-bar">
                    <span>
                      {L.titre} · page {courante.numero} sur {L.pages.length} · {L.fichier}
                    </span>
                    <button type="button" className="btn small">
                      Télécharger l'original
                    </button>
                  </div>
                  <h2>{courante.titre ?? `Page ${courante.numero}`}</h2>
                  <p className="sub">
                    {L.titre} · page {courante.numero}
                  </p>
                  <BlocsPage blocs={blocsDepuisJson(courante.blocs)} images={images} />
                </article>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}

createRoot(document.getElementById("app")!).render(<Apercu />);
