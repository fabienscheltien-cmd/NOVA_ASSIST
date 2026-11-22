/**
 * Consignes et lecture des réponses de l'IA (module pur, testé sous Node).
 * Quatre usages : structuration d'un livret, Serenity, alertes d'incohérences, fiches réflexes.
 */
import type { Bloc } from "../livret/blocs.ts";

export const REPONSE_INCONNUE = "Je ne sais pas, désolé.";

/** Extrait le premier objet JSON d'une réponse (tolère les balises ```json et le texte autour). */
export function extraireJson(texte: string): unknown {
  const sansBalises = texte.replace(/```(?:json)?/gi, "");
  const debut = sansBalises.indexOf("{");
  const fin = sansBalises.lastIndexOf("}");
  if (debut === -1 || fin <= debut) throw new Error("Réponse IA sans JSON.");
  return JSON.parse(sansBalises.slice(debut, fin + 1));
}

const chaine = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const tableau = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const objet = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};

/* -------------------------------------------------------------------------- */
/* Contexte commun : livrets et compléments d'un site, avec des repères courts. */
/* -------------------------------------------------------------------------- */

export type PageContexte = { numero: number; titre: string | null; texte: string };
export type LivretContexte = { id: string; titre: string; pages: PageContexte[] };
export type ComplementContexte = { id: string; question: string; reponse: string };

export type Reperes = {
  livrets: Map<string, LivretContexte>; // « L1 » -> livret
  complements: Map<string, ComplementContexte>; // « C1 » -> complément
};

export function construireContexte(
  livrets: LivretContexte[],
  complements: ComplementContexte[] = [],
): { texte: string; reperes: Reperes } {
  const reperes: Reperes = { livrets: new Map(), complements: new Map() };
  const parties: string[] = [];
  livrets.forEach((l, i) => {
    const ref = `L${i + 1}`;
    reperes.livrets.set(ref, l);
    parties.push(`=== LIVRET ${ref} : « ${l.titre} » ===`);
    for (const p of l.pages) {
      parties.push(`--- [${ref} p.${p.numero}]${p.titre ? ` ${p.titre}` : ""} ---`);
      parties.push(p.texte);
    }
  });
  if (complements.length > 0) {
    parties.push("=== COMPLÉMENTS AJOUTÉS PAR L'ADMINISTRATEUR ===");
    complements.forEach((c, i) => {
      const ref = `C${i + 1}`;
      reperes.complements.set(ref, c);
      parties.push(`[${ref}] Question : ${c.question}\nRéponse : ${c.reponse}`);
    });
  }
  return { texte: parties.join("\n"), reperes };
}

export type SourceReponse =
  | { type: "livret"; livretId: string; livretTitre: string; page: number }
  | { type: "complement"; complementId: string };

/** Transforme « L1 p.12 » ou « C2 » en source vérifiée (null si le repère n'existe pas). */
export function resoudreSource(ref: string, reperes: Reperes): SourceReponse | null {
  const m = /^\s*\[?\s*(L\d+)\s*(?:·|,|-)?\s*p\.?\s*(\d+)\s*\]?\s*$/i.exec(ref);
  if (m) {
    const l = reperes.livrets.get((m[1] ?? "").toUpperCase());
    const page = Number(m[2]);
    if (l && l.pages.some((p) => p.numero === page)) {
      return { type: "livret", livretId: l.id, livretTitre: l.titre, page };
    }
    return null;
  }
  const c = /^\s*\[?\s*(C\d+)\s*\]?\s*$/i.exec(ref);
  if (c) {
    const comp = reperes.complements.get((c[1] ?? "").toUpperCase());
    return comp ? { type: "complement", complementId: comp.id } : null;
  }
  return null;
}

/* ----------------------------------- Serenity ----------------------------------- */

export function consigneSerenity(nomSite: string, contexte: string): string {
  return `Tu es Serenity, l'assistante de l'accueil NOVA du site « ${nomSite} ». Tu réponds aux hôtesses et hôtes d'accueil.

RÈGLES STRICTES
1. Tu réponds UNIQUEMENT à partir des LIVRETS et COMPLÉMENTS ci-dessous. Aucune connaissance extérieure, aucune supposition.
2. Noms, téléphones, e-mails, prix, horaires et étapes sont recopiés exactement comme dans le livret. Tu n'inventes jamais une procédure, un prix, un nom ou un numéro.
3. Si l'information n'y est pas, réponds avec "trouve": false. Ne propose pas d'alternative, ne devine pas.
4. Si le livret indique « À compléter » ou une valeur vide, dis-le clairement au lieu d'inventer.
5. Si deux livrets se contredisent, donne la version de chaque livret en le nommant, sans trancher.
6. Vouvoiement, ton chaleureux et professionnel, en français. Réponse courte. Pour une procédure, liste numérotée (« 1. ») ; pour plusieurs éléments, tirets (« - »). Tu peux mettre un mot en **gras**.
7. Cite toutes tes sources avec leurs repères exacts : « L1 p.12 » pour une page de livret, « C1 » pour un complément.
8. Une question sans rapport avec le site ou ses procédures : "trouve": false.

FORMAT DE SORTIE : uniquement un objet JSON, sans texte autour :
{"trouve": true, "reponse": "texte de la réponse", "sources": ["L1 p.12"]}
ou {"trouve": false, "reponse": "", "sources": []}

${contexte || "(aucun livret publié pour ce site)"}`;
}

export type ReponseSerenity = {
  trouve: boolean;
  reponse: string;
  sources: SourceReponse[];
};

/**
 * Lit la réponse de Serenity. Garde-fou contre l'invention : une réponse sans aucune source
 * vérifiable est remplacée par la réponse exacte « Je ne sais pas, désolé. ».
 */
export function lireReponseSerenity(texte: string, reperes: Reperes): ReponseSerenity {
  const inconnue: ReponseSerenity = { trouve: false, reponse: REPONSE_INCONNUE, sources: [] };
  if (texte.trim() === REPONSE_INCONNUE) return inconnue;
  let brut: Record<string, unknown>;
  try {
    brut = objet(extraireJson(texte));
  } catch {
    return inconnue;
  }
  const reponse = chaine(brut["reponse"]);
  if (brut["trouve"] !== true || !reponse || reponse === REPONSE_INCONNUE) return inconnue;
  const vues = new Set<string>();
  const sources: SourceReponse[] = [];
  for (const r of tableau(brut["sources"])) {
    const s = resoudreSource(chaine(r), reperes);
    if (!s) continue;
    const cle = s.type === "livret" ? `${s.livretId}:${s.page}` : s.complementId;
    if (vues.has(cle)) continue;
    vues.add(cle);
    sources.push(s);
  }
  if (sources.length === 0) return inconnue;
  return { trouve: true, reponse, sources };
}

/* ------------------------------- Structuration ------------------------------- */

export type PageAStructurer = { numero: number; titre: string | null; blocs: Bloc[] };

const TYPES_TEXTE = new Set(["h", "p", "tip"]);

export function consigneStructuration(titreLivret: string, pages: PageAStructurer[]): string {
  const lignes = pages.map((p) => {
    const blocs = p.blocs
      .map((b, i) => {
        if (b.t === "table")
          return `  [${i}] table (${b.rows.length} lignes) : ${b.rows[0]?.join(" | ") ?? ""}`;
        if (b.t === "image") return `  [${i}] image`;
        if (b.t === "ul" || b.t === "ol" || b.t === "steps")
          return `  [${i}] ${b.t} : ${b.items.slice(0, 3).join(" / ")}${b.items.length > 3 ? " / …" : ""}`;
        return `  [${i}] ${b.t} : ${b.x.slice(0, 160)}`;
      })
      .join("\n");
    return `PAGE ${p.numero}\n${blocs}`;
  });
  return `Tu structures le livret de procédures « ${titreLivret} » extrait d'un fichier. Tu ne modifies JAMAIS le texte : tu proposes seulement
- un titre court (6 mots max) pour chaque page, repris des mots de la page quand c'est possible ;
- des changements de type de bloc, parmi : p→h (vrai intertitre), p→tip (encadré « Astuce », « Important », « Attention »), h→p (faux titre), ol→steps (procédure étape par étape).

Réponds uniquement en JSON :
{"pages": [{"numero": 1, "titre": "…", "types": [{"i": 0, "t": "h"}]}]}

${lignes.join("\n\n")}`;
}

/** Applique la structuration proposée sans jamais toucher au texte. */
export function appliquerStructuration(
  pages: PageAStructurer[],
  reponse: unknown,
): PageAStructurer[] {
  const proposees = new Map<number, Record<string, unknown>>();
  for (const p of tableau(objet(reponse)["pages"])) {
    const o = objet(p);
    if (typeof o["numero"] === "number") proposees.set(o["numero"], o);
  }
  return pages.map((page) => {
    const prop = proposees.get(page.numero);
    if (!prop) return page;
    const blocs = page.blocs.map((b) => ({ ...b })) as Bloc[];
    for (const ch of tableau(prop["types"])) {
      const { i, t } = objet(ch);
      if (typeof i !== "number" || typeof t !== "string") continue;
      const b = blocs[i];
      if (!b) continue;
      if (TYPES_TEXTE.has(b.t) && TYPES_TEXTE.has(t) && "x" in b) {
        blocs[i] = { t: t as "h" | "p" | "tip", x: b.x };
      } else if (b.t === "ol" && t === "steps") {
        blocs[i] = { t: "steps", items: b.items };
      }
    }
    const titre = chaine(prop["titre"]).slice(0, 120);
    return { ...page, titre: titre || page.titre, blocs };
  });
}

/* ---------------------------- Alertes d'incohérences ---------------------------- */

export function consigneIncoherences(nomSite: string, contexte: string): string {
  return `Tu relis les livrets de procédures du site « ${nomSite} » pour l'administratrice NOVA. Signale :
- "contradiction" : une même information donnée différemment dans deux endroits (adresse, horaires, téléphone, prix, nom d'un référent, règle) ;
- "a_completer" : une mention « À compléter », « À définir », « TBD », une case ou valeur visiblement vide là où une information est attendue ;
- "autre" : une mention qui semble appartenir à un autre site ou client, ou une erreur manifeste.
Ne signale que ce qui est clairement visible dans le texte, sans juger le fond des procédures. Au plus 25 alertes, les plus utiles d'abord.
Pour chaque alerte, cite les repères exacts (« L1 p.4 ») et recopie l'extrait concerné (moins de 20 mots).

Réponds uniquement en JSON :
{"alertes": [{"type": "contradiction", "titre": "Adresse du site", "description": "…", "sources": [{"ref": "L1 p.4", "extrait": "…"}]}]}
Si rien à signaler : {"alertes": []}

${contexte}`;
}

export type AlerteLue = {
  type: "contradiction" | "a_completer" | "autre";
  titre: string;
  description: string;
  sources: { livret_id: string; livret_titre: string; page: number; extrait: string }[];
};

export function lireIncoherences(reponse: unknown, reperes: Reperes): AlerteLue[] {
  const res: AlerteLue[] = [];
  for (const a of tableau(objet(reponse)["alertes"]).slice(0, 25)) {
    const o = objet(a);
    const type = o["type"];
    if (type !== "contradiction" && type !== "a_completer" && type !== "autre") continue;
    const titre = chaine(o["titre"]).slice(0, 160);
    const description = chaine(o["description"]).slice(0, 1000);
    if (!titre || !description) continue;
    const sources: AlerteLue["sources"] = [];
    for (const s of tableau(o["sources"])) {
      const so = objet(s);
      const src = resoudreSource(chaine(so["ref"]), reperes);
      if (src?.type === "livret") {
        sources.push({
          livret_id: src.livretId,
          livret_titre: src.livretTitre,
          page: src.page,
          extrait: chaine(so["extrait"]).slice(0, 300),
        });
      }
    }
    if (sources.length === 0) continue; // pas de source vérifiable : on n'alerte pas
    res.push({ type, titre, description, sources });
  }
  return res;
}

/* ------------------------------- Fiches réflexes ------------------------------- */

export function consigneFiches(titreLivret: string, contexte: string): string {
  return `À partir du seul livret « ${titreLivret} » ci-dessous, rédige des fiches réflexes pour une hôtesse d'accueil : les situations fréquentes ou sensibles (colis, courrier, visiteurs, réclamations, absences, urgences, dépôts…), chacune en 3 à 7 étapes courtes et concrètes.
Règles : uniquement ce que dit le livret ; noms, numéros, prix et délais recopiés exactement ; pas de fiche si le livret ne décrit pas la procédure. Entre 3 et 8 fiches, les plus utiles d'abord. Indique la page source principale.

Réponds uniquement en JSON :
{"fiches": [{"titre": "Un livreur dépose un colis", "quand": "Un livreur se présente à l'accueil avec un colis", "etapes": ["…", "…"], "page": 12}]}

${contexte}`;
}

export type FicheLue = {
  titre: string;
  quand: string | null;
  etapes: string[];
  page: number | null;
};

export function lireFiches(reponse: unknown, pagesExistantes: Set<number>): FicheLue[] {
  const res: FicheLue[] = [];
  for (const f of tableau(objet(reponse)["fiches"]).slice(0, 8)) {
    const o = objet(f);
    const titre = chaine(o["titre"]).slice(0, 160);
    const etapes = tableau(o["etapes"])
      .map((e) => chaine(e).slice(0, 400))
      .filter((e) => e.length > 0)
      .slice(0, 10);
    if (!titre || etapes.length < 2) continue;
    const page = typeof o["page"] === "number" && pagesExistantes.has(o["page"]) ? o["page"] : null;
    res.push({ titre, quand: chaine(o["quand"]).slice(0, 300) || null, etapes, page });
  }
  return res;
}
