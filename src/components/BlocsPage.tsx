import type { Bloc } from "@/lib/livret/blocs";

const MONTANT = /^-?\d[\d\s.,]*\s?(€|%|EUR)$/i;

function Tableau({ rows, head }: { rows: string[][]; head?: boolean | undefined }) {
  const largeur = Math.max(...rows.map((r) => r.length));
  const entete = head && rows.length > 1 ? (rows[0] ?? null) : null;
  const corps = entete ? rows.slice(1) : rows;
  return (
    <div className="tablewrap">
      <table>
        {entete && (
          <thead>
            <tr>
              {Array.from({ length: largeur }, (_, i) => (
                <th key={i}>{entete[i] ?? ""}</th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {corps.map((r, i) => {
            const remplies = r.filter((c) => c.trim().length > 0);
            // Ligne de regroupement (une seule cellule remplie, en première colonne) : comme dans le livret.
            if (largeur > 1 && remplies.length === 1 && r[0]?.trim()) {
              return (
                <tr key={i}>
                  <td className="grp" colSpan={largeur}>
                    {r[0]}
                  </td>
                </tr>
              );
            }
            return (
              <tr key={i}>
                {Array.from({ length: largeur }, (_, k) => {
                  const c = r[k] ?? "";
                  return (
                    <td key={k} className={MONTANT.test(c.trim()) ? "num" : undefined}>
                      {c}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Retranscription d'une page de livret, bloc par bloc, dans l'ordre d'origine. */
export function BlocsPage({ blocs, images }: { blocs: Bloc[]; images: Record<string, string> }) {
  return (
    <>
      {blocs.map((b, i) => {
        switch (b.t) {
          case "h":
            return <h4 key={i}>{b.x}</h4>;
          case "p":
            return <p key={i}>{b.x}</p>;
          case "tip":
            return (
              <div key={i} className="tip">
                {b.x}
              </div>
            );
          case "ul":
            return (
              <ul key={i} className="plain">
                {b.items.map((t, k) => (
                  <li key={k}>{t}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="plain">
                {b.items.map((t, k) => (
                  <li key={k}>{t}</li>
                ))}
              </ol>
            );
          case "steps":
            return (
              <ol key={i} className="steps">
                {b.items.map((t, k) => (
                  <li key={k}>
                    <span className="k">{k + 1}</span>
                    <div>{t}</div>
                  </li>
                ))}
              </ol>
            );
          case "table":
            return <Tableau key={i} rows={b.rows} head={b.head} />;
          case "image": {
            const url = images[b.path];
            return (
              <figure key={i}>
                {url ? (
                  <img src={url} alt={b.alt ?? "Image du livret"} loading="lazy" />
                ) : (
                  <div className="placeholder">Image en cours de chargement…</div>
                )}
                {b.alt && <figcaption>{b.alt}</figcaption>}
              </figure>
            );
          }
        }
      })}
    </>
  );
}
