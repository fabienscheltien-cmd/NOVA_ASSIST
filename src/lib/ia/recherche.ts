/**
 * Sélection des pages utiles à une question, par mots-clés (module pur, côté serveur).
 * Réduit ce qui est envoyé à l'IA : moins de tokens par question, donc davantage de questions
 * dans le quota IA gratuit de Lovable.
 */
import type { LivretContexte } from "./prompts.ts";

const MOTS_VIDES = new Set(
  (
    "a au aux avec ce ces cet cette comment dans de des du elle en est et etre faire fait il ils je la le les leur " +
    "lui ma mais me mes mon ne nos notre nous on ou par pas pour qu que quel quelle quelles quels qui sa se ses son " +
    "sont sur ta te tes ton tu un une vos votre vous y si doit dois peut puis quand quoi ou est-ce svp merci bonjour"
  ).split(" "),
);

/** Mots significatifs, sans accents ni pluriel simple. */
export function motsCles(texte: string): string[] {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((m) => m.length > 1 && !MOTS_VIDES.has(m))
    .map((m) => (m.length > 4 && m.endsWith("s") ? m.slice(0, -1) : m));
}

export type PageNotee = { livretIndex: number; numero: number; score: number };

/** Note chaque page selon les mots de la question qu'elle contient (titre compté double). */
export function noterPages(livrets: LivretContexte[], question: string): PageNotee[] {
  const cles = [...new Set(motsCles(question))];
  if (cles.length === 0) return [];
  const res: PageNotee[] = [];
  livrets.forEach((l, livretIndex) => {
    for (const p of l.pages) {
      const corps = new Set(motsCles(p.texte));
      const titre = new Set(motsCles(p.titre ?? ""));
      let score = 0;
      for (const c of cles) {
        if (titre.has(c)) score += 2;
        if (corps.has(c)) score += 1;
        // Correspondance partielle (« livreur » ~ « livraison ») : radical de 5 lettres.
        else if (c.length >= 6 && [...corps].some((m) => m.startsWith(c.slice(0, 5)))) score += 0.5;
      }
      if (score > 0) res.push({ livretIndex, numero: p.numero, score });
    }
  });
  return res.sort((a, b) => b.score - a.score);
}

/**
 * Livrets réduits aux pages les plus pertinentes pour la question, dans la limite d'un budget de caractères.
 * Si tout tient dans le budget, rien n'est retiré (Serenity voit alors tout le livret).
 */
export function selectionnerPages(
  livrets: LivretContexte[],
  question: string,
  budget = 24_000,
): LivretContexte[] {
  const taille = (l: LivretContexte[]) =>
    l.reduce((t, x) => t + x.pages.reduce((u, p) => u + p.texte.length, 0), 0);
  if (taille(livrets) <= budget) return livrets;
  const notes = noterPages(livrets, question);
  const gardees = new Set<string>();
  let total = 0;
  for (const n of notes) {
    const page = livrets[n.livretIndex]?.pages.find((p) => p.numero === n.numero);
    if (!page) continue;
    if (total + page.texte.length > budget && gardees.size > 0) break;
    gardees.add(`${n.livretIndex}:${n.numero}`);
    total += page.texte.length;
  }
  return livrets.map((l, i) => ({
    ...l,
    pages: l.pages.filter((p) => gardees.has(`${i}:${p.numero}`)),
  }));
}
