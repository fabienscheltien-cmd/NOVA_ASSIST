import type { ReactNode } from "react";

/** Gras **…** dans une ligne, sans HTML brut. */
function enLigne(s: string): ReactNode[] {
  return s
    .split(/(\*\*[^*]+\*\*)/g)
    .map((m, i) =>
      m.startsWith("**") && m.endsWith("**") && m.length > 4 ? (
        <strong key={i}>{m.slice(2, -2)}</strong>
      ) : (
        m
      ),
    );
}

/** Mise en forme légère des réponses de Serenity : paragraphes, listes à tirets et numérotées. */
export function Texte({ texte }: { texte: string }) {
  const blocs: ReactNode[] = [];
  const etat: { liste: { type: "ul" | "ol"; items: string[] } | null } = { liste: null };
  const vider = () => {
    const l = etat.liste;
    if (!l) return;
    const items = l.items.map((t, i) => <li key={i}>{enLigne(t)}</li>);
    blocs.push(
      l.type === "ul" ? <ul key={blocs.length}>{items}</ul> : <ol key={blocs.length}>{items}</ol>,
    );
    etat.liste = null;
  };
  for (const brut of texte.split("\n")) {
    const l = brut.trim();
    const puce = /^[-•*]\s+(.*)$/.exec(l);
    const num = /^\d{1,2}[.)]\s+(.*)$/.exec(l);
    if (puce || num) {
      const type = puce ? "ul" : "ol";
      if (etat.liste?.type !== type) vider();
      etat.liste ??= { type, items: [] };
      etat.liste.items.push((puce ?? num)?.[1] ?? "");
    } else {
      vider();
      if (l) blocs.push(<p key={blocs.length}>{enLigne(l)}</p>);
    }
  }
  vider();
  return <>{blocs}</>;
}
