import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { extrairePptx } from "./pptx.ts";
import { extraireDocx, pagesDepuisHtml } from "./docx.ts";
import { blocsDepuisElements } from "./pdf.ts";
import { controleFidelite, normaliser, texteBrut } from "./blocs.ts";

// Chemins relatifs à la racine du dépôt (les tests sont lancés depuis la racine).
const lire = (chemin: string) => readFileSync(resolve(process.cwd(), chemin));

/** Texte (hors tableaux et images) d'une diapositive de la transcription Markdown. */
function diapositiveMd(fichier: string, n: number): string {
  const md = lire(`docs/livrets-exemples/${fichier}`).toString("utf8");
  const parts = md.split(/^## Diapositive (\d+)\s*$/m);
  const i = parts.findIndex((p, k) => k % 2 === 1 && Number(p) === n);
  return (parts[i + 1] ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && l !== "[image]" && !/^\|[\s\-|:]+\|$/.test(l))
    .map((l) =>
      l.startsWith("|")
        ? l
            .slice(1, -1)
            .split("|")
            .map((c) => c.trim())
            .filter(Boolean)
            .join(" ")
        : l,
    )
    .join("\n");
}

test("pptx : une page par diapositive, dans l'ordre", async () => {
  const r = await extrairePptx(lire("tests/fixtures/livret-accueil-seine-avenue.pptx"));
  assert.equal(r.pages.length, 22);
  assert.deepEqual(
    r.pages.map((p) => p.numero),
    Array.from({ length: 22 }, (_, i) => i + 1),
  );
  const conc = await extrairePptx(lire("tests/fixtures/livret-conciergerie-seine-avenue.pptx"));
  assert.equal(conc.pages.length, 29);
});

test("pptx : texte et tableaux retranscrits sans perte (colis, absences, tarifs)", async () => {
  const acc = await extrairePptx(lire("tests/fixtures/livret-accueil-seine-avenue.pptx"));
  for (const n of [4, 12, 21]) {
    const page = acc.pages[n - 1];
    assert.ok(page);
    const f = controleFidelite(
      diapositiveMd("livret-accueil-seine-avenue.md", n),
      texteBrut(page.blocs),
    );
    assert.equal(f.couverture, 1, `diapositive ${n} : ${f.manquants.join(" / ")}`);
  }
  const colis = texteBrut(acc.pages[11]!.blocs);
  assert.match(colis, /Aucun colis ne doit être conservé/);
  assert.match(colis, /Eli/);
  const absences = acc.pages[20]!.blocs.find((b) => b.t === "table");
  assert.ok(absences && absences.t === "table");

  const conc = await extrairePptx(lire("tests/fixtures/livret-conciergerie-seine-avenue.pptx"));
  const tarifs = texteBrut(conc.pages[16]!.blocs);
  assert.match(tarifs, /Chemise sur cintre \| 5,00 €/);
  assert.match(tarifs, /Chemise pliée \| 6,00 €/);
});

test("pptx : les images sont extraites et référencées", async () => {
  const conc = await extrairePptx(lire("tests/fixtures/livret-conciergerie-seine-avenue.pptx"));
  const p1 = conc.pages[0]!;
  const imgs = p1.blocs.filter((b) => b.t === "image");
  assert.ok(imgs.length >= 5);
  assert.equal(p1.images?.length, imgs.length);
  assert.equal(p1.images?.[0]?.type, "image/jpeg");
});

test("docx : découpe par titre et conserve tableaux et images", async () => {
  const buf = lire("tests/fixtures/livret-accueil-seine-avenue.docx");
  const r = await extraireDocx(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
  );
  assert.equal(r.pages.length, 22);
  const p12 = r.pages[11]!;
  assert.equal(p12.titre, "Page 12");
  const f = controleFidelite(
    diapositiveMd("livret-accueil-seine-avenue.md", 12),
    texteBrut(p12.blocs),
  );
  assert.equal(f.couverture, 1, f.manquants.join(" / "));
  assert.ok(r.pages[0]!.blocs.some((b) => b.t === "image"));
  assert.ok(r.pages[3]!.blocs.some((b) => b.t === "table"));
});

test("docx : listes imbriquées aplaties", () => {
  const pages = pagesDepuisHtml(
    "<h1>A</h1><ul><li>un<ul><li>sous</li></ul></li><li>deux</li></ul>",
  );
  assert.deepEqual(pages[0]?.blocs[1], { t: "ul", items: ["un", "– sous", "deux"] });
});

test("pdf : lignes regroupées, puces reconnues", () => {
  const blocs = blocsDepuisElements([
    { str: "COLIS", x: 10, y: 800, h: 20 },
    { str: "Aucun colis ne doit être", x: 10, y: 760, h: 10 },
    { str: "conservé à l'accueil.", x: 10, y: 748, h: 10 },
    { str: "• Consulter l'annuaire", x: 10, y: 720, h: 10 },
    { str: "• Contacter Eli", x: 10, y: 708, h: 10 },
  ]);
  assert.deepEqual(blocs, [
    { t: "h", x: "COLIS" },
    { t: "p", x: "Aucun colis ne doit être conservé à l'accueil." },
    { t: "ul", items: ["Consulter l'annuaire", "Contacter Eli"] },
  ]);
});

test("contrôle de fidélité : détecte un texte tronqué", () => {
  const src = "Chemise sur cintre 5,00 €\nChemise pliée 6,00 €";
  assert.equal(controleFidelite(src, src).ok, true);
  const r = controleFidelite(src, "Chemise sur cintre 5,00 €");
  assert.equal(r.ok, false);
  assert.deepEqual(r.manquants, ["Chemise pliée 6,00 €"]);
  assert.equal(normaliser("  Él  é "), "el e");
});
