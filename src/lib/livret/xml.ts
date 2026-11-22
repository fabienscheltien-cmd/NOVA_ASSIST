/** Petits utilitaires de lecture XML/HTML sans DOM (fonctionnent au navigateur et sous Node). */

export function decoder(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Tous les fragments `<prefix:tag ...>...</prefix:tag>` (ou auto-fermants) au premier niveau rencontré. */
export function elements(xml: string, tag: string): string[] {
  const res: string[] = [];
  const ouvrant = new RegExp(`<${tag}(?=[\\s>/])`, "g");
  let m: RegExpExecArray | null;
  let depuis = 0;
  ouvrant.lastIndex = 0;
  while ((m = ouvrant.exec(xml))) {
    if (m.index < depuis) continue;
    const fin = finElement(xml, m.index, tag);
    res.push(xml.slice(m.index, fin));
    depuis = fin;
    ouvrant.lastIndex = fin;
  }
  return res;
}

/** Position juste après la balise fermante correspondant à l'élément ouvert en `debut`. */
export function finElement(xml: string, debut: number, tag: string): number {
  const finOuvrant = xml.indexOf(">", debut);
  if (finOuvrant === -1) return xml.length;
  if (xml[finOuvrant - 1] === "/") return finOuvrant + 1;
  const re = new RegExp(`<${tag}(?=[\\s>/])|</${tag}>`, "g");
  re.lastIndex = finOuvrant + 1;
  let profondeur = 1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    if (m[0].startsWith("</")) {
      profondeur--;
      if (profondeur === 0) return m.index + m[0].length;
    } else {
      const fo = xml.indexOf(">", m.index);
      if (fo !== -1 && xml[fo - 1] !== "/") profondeur++;
    }
  }
  return xml.length;
}

export function attribut(fragment: string, nom: string): string | null {
  const m = new RegExp(`\\s${nom}="([^"]*)"`).exec(fragment);
  return m ? decoder(m[1] ?? "") : null;
}

export function espaces(s: string): string {
  return s.replace(/[\u00a0\s]+/g, " ").trim();
}
