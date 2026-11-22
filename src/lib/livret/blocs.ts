/**
 * Blocs de contenu d'une page de livret, partagés par l'extraction (navigateur),
 * le stockage (`livret_pages.contenu`), l'affichage « Détail » et Serenity.
 * Module pur : aucune dépendance au navigateur ni au serveur (testable sous Node).
 */

export type Bloc =
  | { t: "h"; x: string }
  | { t: "p"; x: string }
  | { t: "tip"; x: string }
  | { t: "ul"; items: string[] }
  | { t: "ol"; items: string[] }
  | { t: "steps"; items: string[] }
  | { t: "table"; rows: string[][]; head?: boolean }
  | { t: "image"; path: string; alt?: string };

export type PageExtraite = {
  numero: number;
  titre: string | null;
  blocs: Bloc[];
  /** Images à téléverser : la clé correspond à `path` du bloc image (relatif au livret). */
  images?: { path: string; data: Uint8Array; type: string }[];
};

export type ResultatExtraction = {
  pages: PageExtraite[];
  avertissement: string | null;
};

/** Texte brut d'une page, ligne par ligne, dans l'ordre d'origine. Sert au chat et au contrôle. */
export function texteBrut(blocs: Bloc[]): string {
  const lignes: string[] = [];
  for (const b of blocs) {
    switch (b.t) {
      case "h":
      case "p":
      case "tip":
        lignes.push(b.x);
        break;
      case "ul":
        for (const i of b.items) lignes.push(`- ${i}`);
        break;
      case "ol":
      case "steps":
        b.items.forEach((i, k) => lignes.push(`${k + 1}. ${i}`));
        break;
      case "table":
        for (const r of b.rows) lignes.push(`| ${r.join(" | ")} |`);
        break;
      case "image":
        lignes.push("[image]");
        break;
    }
  }
  return lignes.join("\n");
}

/** Normalise un texte pour la comparaison : casse, accents, espaces et puces ignorés. */
export function normaliser(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9€%@.,:;!?'/+()-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Mots significatifs d'un texte, dans l'ordre. */
function mots(s: string): string[] {
  return normaliser(s)
    .split(" ")
    .map((m) => m.replace(/^[.,:;!?()-]+|[.,:;!?()-]+$/g, ""))
    .filter((m) => m.length > 0);
}

export type ResultatFidelite = {
  ok: boolean;
  /** Part des mots de la source retrouvés, dans l'ordre, dans la retranscription (0 à 1). */
  couverture: number;
  /** Lignes de la source absentes de la retranscription (au plus 20). */
  manquants: string[];
};

/**
 * Contrôle de fidélité : chaque mot du texte extrait doit se retrouver, dans le même ordre,
 * dans le texte retranscrit. Tolère ce qui est ajouté (titres de page), jamais ce qui manque.
 */
export function controleFidelite(source: string, retranscrit: string): ResultatFidelite {
  const src = mots(source);
  const dst = mots(retranscrit);
  let j = 0;
  let trouves = 0;
  for (const m of src) {
    let k = j;
    while (k < dst.length && dst[k] !== m) k++;
    if (k < dst.length) {
      trouves++;
      j = k + 1;
    }
  }
  const couverture = src.length === 0 ? 1 : trouves / src.length;
  const cible = new Set(
    normaliser(retranscrit)
      .split("\n")
      .map((l) => l.trim()),
  );
  const texteCible = normaliser(retranscrit);
  const manquants = source
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .filter((l) => {
      const n = normaliser(l.replace(/^(- |\d+\. )/, ""));
      return n.length > 0 && !cible.has(n) && !texteCible.includes(n);
    })
    .slice(0, 20);
  return { ok: couverture === 1 && manquants.length === 0, couverture, manquants };
}

/** Vrai si une page ne contient presque pas de texte (PDF scanné, diapositive image). */
export function pageSansTexte(blocs: Bloc[]): boolean {
  return (
    texteBrut(blocs)
      .replace(/\[image\]/g, "")
      .replace(/\s+/g, "").length < 15
  );
}

/** Valide grossièrement un contenu JSON venu de la base. */
export function estBloc(v: unknown): v is Bloc {
  if (!v || typeof v !== "object") return false;
  const t = (v as { t?: unknown }).t;
  return (
    t === "h" ||
    t === "p" ||
    t === "tip" ||
    t === "ul" ||
    t === "ol" ||
    t === "steps" ||
    t === "table" ||
    t === "image"
  );
}

export function blocsDepuisJson(v: unknown): Bloc[] {
  return Array.isArray(v) ? v.filter(estBloc) : [];
}

/** Titre de page provisoire (avant la structuration par l'IA) : premier intertitre, sinon première ligne courte. */
export function titreParDefaut(blocs: Bloc[]): string | null {
  const h = blocs.find((b): b is { t: "h"; x: string } => b.t === "h");
  if (h) return h.x.slice(0, 120);
  const p = blocs.find((b): b is { t: "p"; x: string } => b.t === "p" && b.x.length <= 80);
  return p ? p.x : null;
}
