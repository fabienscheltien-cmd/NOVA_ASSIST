import { test } from "vitest";
import assert from "node:assert/strict";
import {
  REPONSE_INCONNUE,
  appliquerStructuration,
  construireContexte,
  extraireJson,
  lireFiches,
  lireIncoherences,
  lireReponseSerenity,
} from "./prompts.ts";

const livrets = [
  {
    id: "acc",
    titre: "Accueil",
    pages: [
      { numero: 4, titre: "Contacts", texte: "Adresse | 4-8 Rue Sarah Bernhardt" },
      { numero: 12, titre: "Colis", texte: "Aucun colis ne doit être conservé à l'accueil." },
    ],
  },
  {
    id: "conc",
    titre: "Conciergerie",
    pages: [{ numero: 17, titre: "Tarifs", texte: "Chemise sur cintre | 5,00 €" }],
  },
];
const { texte, reperes } = construireContexte(livrets, [
  { id: "c-wifi", question: "Code wifi ?", reponse: "NOVA2026" },
]);

test("contexte : repères courts pour les livrets, pages et compléments", () => {
  assert.match(texte, /=== LIVRET L1 : « Accueil » ===/);
  assert.match(texte, /--- \[L2 p\.17\] Tarifs ---/);
  assert.match(texte, /\[C1\] Question : Code wifi \?/);
});

test("Serenity : réponse sourcée conservée, sources résolues", () => {
  const r = lireReponseSerenity(
    '```json\n{"trouve": true, "reponse": "Sur cintre 5,00 €.", "sources": ["L2 p.17", "L2 p.17", "C1"]}\n```',
    reperes,
  );
  assert.equal(r.trouve, true);
  assert.deepEqual(r.sources, [
    { type: "livret", livretId: "conc", livretTitre: "Conciergerie", page: 17 },
    { type: "complement", complementId: "c-wifi" },
  ]);
});

test("Serenity : « Je ne sais pas, désolé. » exact si non trouvé, sans source ou source inventée", () => {
  for (const brut of [
    '{"trouve": false, "reponse": "", "sources": []}',
    '{"trouve": true, "reponse": "Le code est 1234.", "sources": []}',
    '{"trouve": true, "reponse": "Le code est 1234.", "sources": ["L9 p.1"]}',
    '{"trouve": true, "reponse": "Page inexistante.", "sources": ["L1 p.99"]}',
    "pas du JSON",
    REPONSE_INCONNUE,
  ]) {
    const r = lireReponseSerenity(brut, reperes);
    assert.equal(r.trouve, false, brut);
    assert.equal(r.reponse, "Je ne sais pas, désolé.");
    assert.deepEqual(r.sources, []);
  }
});

test("structuration : titres et types appliqués, texte jamais modifié", () => {
  const pages = [
    {
      numero: 1,
      titre: null,
      blocs: [
        { t: "p" as const, x: "COLIS" },
        { t: "p" as const, x: "Astuce : photographier l'anomalie." },
        { t: "ol" as const, items: ["Accueillir", "Contrôler"] },
        { t: "table" as const, rows: [["a", "b"]] },
      ],
    },
  ];
  const res = appliquerStructuration(pages, {
    pages: [
      {
        numero: 1,
        titre: "Colis",
        types: [
          { i: 0, t: "h" },
          { i: 1, t: "tip" },
          { i: 2, t: "steps" },
          { i: 3, t: "h" }, // interdit : un tableau ne devient pas un titre
          { i: 0, x: "texte réécrit" },
        ],
      },
    ],
  });
  assert.equal(res[0]?.titre, "Colis");
  assert.deepEqual(res[0]?.blocs, [
    { t: "h", x: "COLIS" },
    { t: "tip", x: "Astuce : photographier l'anomalie." },
    { t: "steps", items: ["Accueillir", "Contrôler"] },
    { t: "table", rows: [["a", "b"]] },
  ]);
});

test("incohérences : seules les alertes avec une source vérifiable sont gardées", () => {
  const alertes = lireIncoherences(
    {
      alertes: [
        {
          type: "contradiction",
          titre: "Adresse du site",
          description: "« 4-8 rue » dans Accueil, « 2 rue » dans Conciergerie.",
          sources: [
            { ref: "L1 p.4", extrait: "4-8 Rue Sarah Bernhardt" },
            { ref: "L2 p.99", extrait: "?" },
          ],
        },
        { type: "a_completer", titre: "Sans source", description: "x", sources: [] },
        { type: "inconnu", titre: "t", description: "d", sources: [{ ref: "L1 p.4" }] },
      ],
    },
    reperes,
  );
  assert.equal(alertes.length, 1);
  assert.equal(alertes[0]?.sources.length, 1);
  assert.equal(alertes[0]?.sources[0]?.livret_id, "acc");
});

test("fiches réflexes : filtrage et pages vérifiées", () => {
  const fiches = lireFiches(
    {
      fiches: [
        {
          titre: "Colis",
          quand: "Un livreur arrive",
          etapes: ["Ne pas signer", "Orienter vers l'étage"],
          page: 12,
        },
        { titre: "Une seule étape", etapes: ["x"], page: 12 },
        { titre: "Page inconnue", etapes: ["a", "b"], page: 77 },
      ],
    },
    new Set([4, 12]),
  );
  assert.equal(fiches.length, 2);
  assert.equal(fiches[0]?.page, 12);
  assert.equal(fiches[1]?.page, null);
});

test("extraireJson : tolère le texte autour", () => {
  assert.deepEqual(extraireJson('Voici : {"a": 1} merci'), { a: 1 });
  assert.throws(() => extraireJson("rien"));
});
