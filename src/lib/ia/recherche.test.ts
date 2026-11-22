import { test } from "vitest";
import assert from "node:assert/strict";
import { motsCles, noterPages, selectionnerPages } from "./recherche.ts";

const livrets = [
  {
    id: "acc",
    titre: "Accueil",
    pages: [
      {
        numero: 4,
        titre: "Contacts",
        texte: "Horaires d'ouverture 8h00 – 19h00 du lundi au vendredi. " + "x".repeat(9000),
      },
      {
        numero: 12,
        titre: "Colis",
        texte: "Aucun colis ne doit être conservé à l'accueil. Les livreurs montent aux étages.",
      },
      {
        numero: 21,
        titre: "Absence et retard",
        texte: "Absence prévisible : informer 48h à l'avance. " + "y".repeat(9000),
      },
    ],
  },
  {
    id: "conc",
    titre: "Conciergerie",
    pages: [
      {
        numero: 17,
        titre: "Grille tarifaire pressing",
        texte: "Chemise sur cintre | 5,00 € " + "z".repeat(9000),
      },
    ],
  },
];

test("mots-clés : accents, mots vides et pluriels retirés", () => {
  assert.deepEqual(motsCles("Que faire si un livreur dépose des colis ?"), [
    "livreur",
    "depose",
    "coli",
  ]);
});

test("notation : la page Colis arrive en tête pour une question de livraison", () => {
  const n = noterPages(livrets, "Un livreur dépose un colis, que faire ?");
  assert.equal(n[0]?.numero, 12);
});

test("sélection : seules les pages utiles partent à l'IA quand le livret est gros", () => {
  const s = selectionnerPages(livrets, "Quel est le prix d'une chemise ?", 12_000);
  const pages = s.flatMap((l) => l.pages.map((p) => `${l.id}:${p.numero}`));
  assert.deepEqual(pages, ["conc:17"]);
});

test("sélection : rien n'est retiré si tout tient dans le budget", () => {
  const s = selectionnerPages(livrets, "colis", 1_000_000);
  assert.equal(s[0]?.pages.length, 3);
});
