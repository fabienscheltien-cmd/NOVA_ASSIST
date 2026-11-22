import { decoder, elements, espaces, finElement } from "./xml.ts";
import type { Bloc, PageExtraite, ResultatExtraction } from "./blocs.ts";

const BALISES = ["h1", "h2", "h3", "h4", "h5", "h6", "p", "ul", "ol", "table"];

function texteHtml(html: string): string {
  return espaces(decoder(html.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "")));
}

/** Éléments HTML de premier niveau, dans l'ordre (sortie de mammoth). */
function premierNiveau(html: string): { tag: string; html: string }[] {
  const res: { tag: string; html: string }[] = [];
  const re = new RegExp(`<(${BALISES.join("|")})(?=[\\s>])`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const tag = m[1] ?? "p";
    const fin = finElement(html, m.index, tag);
    res.push({ tag, html: html.slice(m.index, fin) });
    re.lastIndex = fin;
  }
  return res;
}

function itemsListe(html: string): string[] {
  const interieur = html.replace(/^<(ul|ol)[^>]*>/, "").replace(/<\/(ul|ol)>$/, "");
  return elements(interieur, "li")
    .flatMap((li) => {
      // Les sous-listes deviennent des éléments à la suite, préfixés d'un tiret.
      const sous = elements(li, "ul").concat(elements(li, "ol"));
      let propre = li;
      for (const s of sous) propre = propre.replace(s, "");
      return [texteHtml(propre), ...sous.flatMap(itemsListe).map((t) => `– ${t}`)];
    })
    .filter((t) => t.length > 0);
}

function tableau(html: string): Bloc | null {
  const rows = elements(html, "tr").map((tr) =>
    [...elements(tr, "td"), ...elements(tr, "th")].map((c) => texteHtml(c)),
  );
  const utiles = rows.filter((r) => r.some((c) => c.length > 0));
  return utiles.length ? { t: "table", rows: utiles, head: true } : null;
}

type Image = { data: Uint8Array; type: string };

/**
 * Convertit le HTML produit par mammoth en pages : une page par titre de niveau 1
 * (ou de niveau 2 s'il n'y a pas de niveau 1), sinon par tranches de 30 blocs.
 */
export function pagesDepuisHtml(
  html: string,
  images: Map<string, Image> = new Map(),
): PageExtraite[] {
  const els = premierNiveau(html);
  const coupe = els.some((e) => e.tag === "h1")
    ? "h1"
    : els.some((e) => e.tag === "h2")
      ? "h2"
      : null;
  const pages: PageExtraite[] = [];
  let courante: PageExtraite = { numero: 1, titre: null, blocs: [], images: [] };

  const nouvellePage = () => {
    if (courante.blocs.length > 0) pages.push(courante);
    courante = { numero: pages.length + 1, titre: null, blocs: [], images: [] };
  };

  for (const e of els) {
    if ((coupe && e.tag === coupe) || (!coupe && courante.blocs.length >= 30)) nouvellePage();
    if (/^h[1-6]$/.test(e.tag)) {
      const x = texteHtml(e.html);
      if (x) {
        courante.blocs.push({ t: "h", x });
        courante.titre ??= x;
      }
    } else if (e.tag === "ul" || e.tag === "ol") {
      const items = itemsListe(e.html);
      if (items.length) courante.blocs.push({ t: e.tag, items });
    } else if (e.tag === "table") {
      const t = tableau(e.html);
      if (t) courante.blocs.push(t);
    } else {
      // Paragraphe : images éventuelles, puis texte.
      for (const src of e.html.matchAll(/<img[^>]*src="([^"]+)"[^>]*>/g)) {
        const cle = src[1] ?? "";
        const img = images.get(cle);
        if (!img) continue;
        const ext = img.type.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
        const path = `images/p${courante.numero}-${(courante.images?.length ?? 0) + 1}.${ext}`;
        courante.images?.push({ path, data: img.data, type: img.type });
        const alt = /alt="([^"]*)"/.exec(src[0])?.[1];
        courante.blocs.push({ t: "image", path, ...(alt ? { alt: decoder(alt) } : {}) });
      }
      const x = texteHtml(e.html);
      if (x) courante.blocs.push({ t: "p", x });
    }
  }
  nouvellePage();
  return pages;
}

export async function extraireDocx(fichier: ArrayBuffer): Promise<ResultatExtraction> {
  const mammoth = await import("mammoth");
  const lib = (mammoth as unknown as { default?: typeof mammoth }).default ?? mammoth;
  const images = new Map<string, Image>();
  let n = 0;
  // Navigateur : arrayBuffer ; Node (tests, Buffer présent) : buffer.
  const NodeBuffer = (globalThis as { Buffer?: { from(a: ArrayBuffer): unknown } }).Buffer;
  const entree = NodeBuffer
    ? ({ buffer: NodeBuffer.from(fichier) } as unknown as { arrayBuffer: ArrayBuffer })
    : { arrayBuffer: fichier };
  const { value } = await lib.convertToHtml(entree, {
    convertImage: lib.images.imgElement(async (image) => {
      const b64 = await image.read("base64");
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const cle = `nova-image-${++n}`;
      images.set(cle, { data: bin, type: image.contentType });
      return { src: cle };
    }),
  });
  const pages = pagesDepuisHtml(value, images);
  return {
    pages,
    avertissement: pages.length === 0 ? "Aucun texte trouvé dans ce document Word." : null,
  };
}
