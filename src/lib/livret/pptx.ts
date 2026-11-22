import JSZip from "jszip";
import { attribut, decoder, elements, espaces } from "./xml.ts";
import type { Bloc, PageExtraite, ResultatExtraction } from "./blocs.ts";
import { pageSansTexte, titreParDefaut } from "./blocs.ts";

type Forme = { y: number; x: number; ordre: number; blocs: Bloc[] };

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  webp: "image/webp",
};

/** Texte d'un paragraphe DrawingML (`<a:p>`), sauts de ligne compris. */
function texteParagraphe(p: string): string {
  const morceaux: string[] = [];
  const re = /<a:t>([\s\S]*?)<\/a:t>|<a:t\/>|<a:br\b[^>]*\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(p))) {
    if (m[0].startsWith("<a:br")) morceaux.push(" ");
    else morceaux.push(decoder(m[1] ?? ""));
  }
  return espaces(morceaux.join(""));
}

function paragraphes(fragment: string): { texte: string; puce: "aucune" | "puce" | "num" }[] {
  return elements(fragment, "a:p")
    .map((p) => {
      const ppr = /<a:pPr\b[\s\S]*?(?:\/>|<\/a:pPr>)/.exec(p)?.[0] ?? "";
      const puce: "aucune" | "puce" | "num" = ppr.includes("<a:buAutoNum")
        ? "num"
        : ppr.includes("<a:buChar") || ppr.includes("<a:buBlip")
          ? "puce"
          : "aucune";
      return { texte: texteParagraphe(p), puce };
    })
    .filter((p) => p.texte.length > 0);
}

/** Convertit des paragraphes en blocs : listes regroupées, sinon un paragraphe par ligne. */
function blocsDeParagraphes(ps: { texte: string; puce: "aucune" | "puce" | "num" }[]): Bloc[] {
  const blocs: Bloc[] = [];
  for (const p of ps) {
    const dernier = blocs[blocs.length - 1];
    if (p.puce === "puce") {
      if (dernier?.t === "ul") dernier.items.push(p.texte);
      else blocs.push({ t: "ul", items: [p.texte] });
    } else if (p.puce === "num") {
      if (dernier?.t === "ol") dernier.items.push(p.texte);
      else blocs.push({ t: "ol", items: [p.texte] });
    } else {
      blocs.push({ t: "p", x: p.texte });
    }
  }
  return blocs;
}

function position(fragment: string): { x: number; y: number } | null {
  const off = /<a:off\b[^>]*\/>/.exec(fragment)?.[0];
  if (!off) return null;
  return { x: Number(attribut(off, "x") ?? 0), y: Number(attribut(off, "y") ?? 0) };
}

function tableau(fragment: string): Bloc | null {
  const rows = elements(fragment, "a:tr").map((tr) =>
    elements(tr, "a:tc").map((tc) =>
      paragraphes(tc)
        .map((p) => p.texte)
        .join(" "),
    ),
  );
  const utiles = rows.filter((r) => r.some((c) => c.length > 0));
  if (utiles.length === 0) return null;
  return { t: "table", rows: utiles, head: true };
}

/** Résout une cible de relation relative au dossier d'une diapositive. */
function resoudre(base: string, cible: string): string {
  if (cible.startsWith("/")) return cible.slice(1);
  const parts = base.split("/");
  parts.pop();
  for (const seg of cible.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}

function relations(xml: string | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!xml) return map;
  for (const r of elements(xml, "Relationship")) {
    const id = attribut(r, "Id");
    const cible = attribut(r, "Target");
    if (id && cible) map.set(id, cible);
  }
  return map;
}

/** Chemins des diapositives dans l'ordre de la présentation (ou numérique à défaut). */
async function ordreDiapositives(zip: JSZip): Promise<string[]> {
  const pres = await zip.file("ppt/presentation.xml")?.async("string");
  const rels = relations(await zip.file("ppt/_rels/presentation.xml.rels")?.async("string"));
  const ordre: string[] = [];
  if (pres) {
    for (const s of elements(pres, "p:sldId")) {
      const rid = attribut(s, "r:id");
      const cible = rid ? rels.get(rid) : undefined;
      if (cible) ordre.push(resoudre("ppt/presentation.xml", cible));
    }
  }
  if (ordre.length > 0) return ordre.filter((p) => zip.file(p));
  return Object.keys(zip.files)
    .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    .sort((a, b) => Number(/(\d+)\.xml$/.exec(a)?.[1]) - Number(/(\d+)\.xml$/.exec(b)?.[1]));
}

export async function extrairePptx(fichier: ArrayBuffer | Uint8Array): Promise<ResultatExtraction> {
  const zip = await JSZip.loadAsync(fichier);
  const chemins = await ordreDiapositives(zip);
  const pages: PageExtraite[] = [];

  for (const [index, chemin] of chemins.entries()) {
    const numero = index + 1;
    const xml = (await zip.file(chemin)?.async("string")) ?? "";
    const relsChemin = chemin.replace(/slides\/(slide\d+\.xml)$/, "slides/_rels/$1.rels");
    const rels = relations(await zip.file(relsChemin)?.async("string"));
    const formes: Forme[] = [];
    const images: NonNullable<PageExtraite["images"]> = [];
    let yPrecedent = 0;

    const re = /<p:(sp|graphicFrame|pic)(?=[\s>])/g;
    let m: RegExpExecArray | null;
    let ordre = 0;
    while ((m = re.exec(xml))) {
      const tag = `p:${m[1]}`;
      const debut = m.index;
      const ferme = xml.indexOf(`</${tag}>`, debut);
      const fin = ferme === -1 ? xml.length : ferme + tag.length + 3;
      const frag = xml.slice(debut, fin);
      re.lastIndex = fin;
      ordre++;

      const ph = /<p:ph\b[^>]*>/.exec(frag)?.[0] ?? "";
      const typePh = ph ? attribut(ph, "type") : null;
      if (typePh === "sldNum" || typePh === "dt" || typePh === "ftr") continue;

      const pos = position(frag);
      const estTitre = typePh === "title" || typePh === "ctrTitle";
      const y = pos?.y ?? (estTitre ? -1 : yPrecedent);
      const x = pos?.x ?? 0;
      yPrecedent = y;

      let blocs: Bloc[] = [];
      if (m[1] === "graphicFrame") {
        const t = tableau(frag);
        if (t) blocs = [t];
      } else if (m[1] === "pic") {
        const rid = /r:embed="([^"]+)"/.exec(frag)?.[1];
        const cible = rid ? rels.get(rid) : undefined;
        if (cible) {
          const media = resoudre(chemin, cible);
          const data = await zip.file(media)?.async("uint8array");
          const ext = (media.split(".").pop() ?? "png").toLowerCase();
          if (data && MIME[ext]) {
            const path = `images/p${numero}-${images.length + 1}.${ext}`;
            images.push({ path, data, type: MIME[ext] ?? "image/png" });
            // Texte de remplacement : la description saisie dans PowerPoint, jamais un simple nom de fichier.
            const descr = attribut(/<p:cNvPr\b[^>]*>/.exec(frag)?.[0] ?? "", "descr");
            const alt =
              descr && !/\.(png|jpe?g|gif|bmp|svg|webp|emf|wmf)$/i.test(descr) ? descr : null;
            blocs = [{ t: "image", path, ...(alt ? { alt } : {}) }];
          }
        }
      } else {
        const ps = paragraphes(frag);
        if (estTitre && ps.length > 0) blocs = [{ t: "h", x: ps.map((p) => p.texte).join(" ") }];
        else blocs = blocsDeParagraphes(ps);
      }
      if (blocs.length > 0) formes.push({ y, x, ordre, blocs });
    }

    formes.sort((a, b) => a.y - b.y || a.x - b.x || a.ordre - b.ordre);
    const blocs = formes.flatMap((f) => f.blocs);
    pages.push({ numero, titre: titreParDefaut(blocs), blocs, images });
  }

  const vides = pages.filter((p) => pageSansTexte(p.blocs)).length;
  return {
    pages,
    avertissement:
      pages.length === 0
        ? "Aucune diapositive trouvée dans ce fichier."
        : vides > pages.length / 2
          ? `${vides} diapositive(s) sur ${pages.length} ne contiennent presque pas de texte (images ou scans) : leur contenu n'est visible qu'en image.`
          : null,
  };
}
