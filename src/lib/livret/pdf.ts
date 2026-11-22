import type { Bloc, PageExtraite, ResultatExtraction } from "./blocs.ts";
import { pageSansTexte, titreParDefaut } from "./blocs.ts";

export type ElementTexte = { str: string; x: number; y: number; h: number };

const PUCE = /^[•▪●◦○■□➢➤►\-–*]\s*/;
const NUM = /^\d{1,2}[.)]\s+/;

/** Regroupe les morceaux de texte d'une page PDF en lignes, puis en blocs. */
export function blocsDepuisElements(items: ElementTexte[]): Bloc[] {
  const tries = items.filter((i) => i.str.trim().length > 0).sort((a, b) => b.y - a.y || a.x - b.x);
  const lignes: { y: number; h: number; texte: string }[] = [];
  for (const it of tries) {
    const derniere = lignes[lignes.length - 1];
    if (derniere && Math.abs(derniere.y - it.y) <= Math.max(2, it.h * 0.5)) {
      derniere.texte += (/\s$/.test(derniere.texte) || /^\s/.test(it.str) ? "" : " ") + it.str;
    } else {
      lignes.push({ y: it.y, h: it.h || 10, texte: it.str });
    }
  }

  const blocs: Bloc[] = [];
  let precedente: { y: number; h: number } | null = null;
  for (const l of lignes) {
    const texte = l.texte.replace(/\s+/g, " ").trim();
    if (!texte) continue;
    const ecart = precedente ? precedente.y - l.y : 0;
    const nouveauParagraphe = !precedente || ecart > Math.max(precedente.h, l.h) * 1.7;
    const dernier = blocs[blocs.length - 1];
    if (PUCE.test(texte)) {
      const item = texte.replace(PUCE, "");
      if (dernier?.t === "ul") dernier.items.push(item);
      else blocs.push({ t: "ul", items: [item] });
    } else if (NUM.test(texte)) {
      const item = texte.replace(NUM, "");
      if (dernier?.t === "ol") dernier.items.push(item);
      else blocs.push({ t: "ol", items: [item] });
    } else if (!nouveauParagraphe && dernier && (dernier.t === "p" || dernier.t === "h")) {
      dernier.x += ` ${texte}`;
    } else if (!nouveauParagraphe && dernier && (dernier.t === "ul" || dernier.t === "ol")) {
      const i = dernier.items.length - 1;
      dernier.items[i] = `${dernier.items[i] ?? ""} ${texte}`;
    } else {
      // Une ligne nettement plus haute que le texte courant est un titre.
      blocs.push(l.h >= 15 && texte.length < 90 ? { t: "h", x: texte } : { t: "p", x: texte });
    }
    precedente = l;
  }
  return blocs;
}

/** Extraction PDF (navigateur uniquement : pdf.js et son worker). */
export async function extrairePdf(fichier: ArrayBuffer): Promise<ResultatExtraction> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fichier) }).promise;
  const pages: PageExtraite[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const contenu = await page.getTextContent();
    const items: ElementTexte[] = [];
    for (const it of contenu.items) {
      if (!("str" in it)) continue;
      const t = it.transform as number[];
      items.push({ str: it.str, x: t[4] ?? 0, y: t[5] ?? 0, h: Math.abs(it.height || t[3] || 10) });
    }
    const blocs = blocsDepuisElements(items);
    pages.push({ numero: n, titre: titreParDefaut(blocs), blocs, images: [] });
  }
  const vides = pages.filter((p) => pageSansTexte(p.blocs)).length;
  return {
    pages,
    avertissement:
      vides > 0
        ? `${vides} page(s) sur ${pages.length} ne contiennent pas de texte lisible (PDF scanné ?). Cette version ne lit pas les scans : déposez de préférence le fichier Word ou PowerPoint d'origine.`
        : null,
  };
}
