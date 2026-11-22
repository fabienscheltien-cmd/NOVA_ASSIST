# Nova Assist : cahier de construction pour Lovable

Lovable : lis ce fichier en entier, puis `docs/superpowers/specs/2026-11-19-nova-assist-design.md` (design validé), ouvre `docs/maquette/nova-assist-maquette.html` (maquette cliquable à reproduire fidèlement) et regarde `docs/reference/visuel-reference-nova-assist.jpg` (visuel d'origine). Les jeux d'essai sont dans `docs/livrets-exemples/`.

## Mission
Construire **Nova Assist**, page complémentaire de Nova Pass (dépôt `Nova_PASS`, **ne pas le modifier ni le relier**). Un Super Admin dépose des livrets de procédure par site (Word, PDF ou PowerPoint). Une IA les analyse. La rubrique **Détail** les retranscrit à l'identique. La page principale est un chat avec **Serenity**, qui répond uniquement d'après les livrets du site de l'utilisateur.

## Pile technique
- Même pile que Nova_PASS : TanStack Start + React + TypeScript + Tailwind + shadcn/ui, Lovable Cloud (Supabase : base, stockage, auth), IA via la passerelle Lovable AI, comme dans `Nova_PASS/src/lib/assistant.functions.ts` (`@ai-sdk/openai` avec `baseURL https://ai.gateway.lovable.dev/v1`, clé `LOVABLE_API_KEY` côté serveur uniquement, jamais dans le navigateur).
- Tout en français. Hébergement Lovable Cloud (données personnelles).

## Design (à reproduire depuis la maquette)
- Décor : `docs/maquette/assets/bg_clean.jpg` en fond plein écran (`cover`, ancré à droite et en bas, voile marine par-dessus). Serenity y est déjà dessinée. Copier les images dans `src/assets/`.
- Jetons de couleur (définis dans la maquette) : marine `#0a1426 / #0f1d35 / #162a4a`, or `#d9b673` (survol `#b8924a`, texte sur or `#1b1405`), bleu `#2b7bb9`, vert `#1f9d8a`, texte `#eef2f8`, discret `#a3b2c8`, papier `#f3f5f9` avec encre `#1a2740`. Verre dépoli : fond translucide, `backdrop-filter: blur`, bordure blanche à 14 %.
- Polices : Manrope (titres), Inter (texte).
- En-tête : logo `logo.png` à gauche, titre centré « **NOVA** ASSIST » (NOVA en bleu `#5b8fc9`) et sous-titre en majuscules « LIVRET D'ACCUEIL DU SITE <nom du site> », à droite le bouton or « ← Retour à Nova Pass ».
- Chat : panneau en verre gris-bleu. Bulle utilisateur grise claire à gauche, bulle Serenity en dégradé bleu→vert à droite, pastilles de source cliquables (« Livret Accueil · p. 12 »). Colonne droite : bulle de bienvenue à bordure dorée avec Serenity visible dans le décor.
- Serenity est **fixe** (une image, pas de réglage). Sur mobile : petit portrait `serenity_avatar.jpg`/`serenity_full.jpg` à côté de la bulle.
- Mobile : gouttière de 16 px, aucun défilement horizontal, tableaux dans un conteneur défilant.

## Écrans
1. **Serenity (page principale, tous les comptes)** : chat. Message de bienvenue exact : « Bonjour, je suis Serenity ! Posez-moi votre question sur nos hôtes et hôtesses d'accueil, la conciergerie, le courrier, les colis ou nos tarifs. »
2. **Détail (tous les comptes)** : sélecteur de livret (un bouton par livret du site, plus « Compléments (n) »), sommaire des pages à gauche, page retranscrite à droite sur fond papier, boutons page précédente/suivante, bouton « Télécharger l'original ».
3. **Livrets (Super Admin)** : tableau des livrets du site (titre, fichier, format, pages, statut, actions Remplacer / Supprimer), formulaire de dépôt (titre + fichier .docx/.pdf/.pptx) avec progression : Lecture du fichier → Extraction du texte, des tableaux et des images → Structuration par l'IA → Contrôle de fidélité → Publication.
4. **Questions sans réponse (Super Admin)** : pastille de compteur sur l'onglet, une carte par question (texte, site, date), zone « Votre réponse », bouton « Ajouter aux compléments ». Une question traitée affiche « ✓ Ajoutée aux compléments : Serenity pourra maintenant y répondre. »
5. Le Super Admin choisit le site (sélecteur en en-tête). Un compte d'accueil ne voit que son site, sans sélecteur.

## Comportement de Serenity (règles strictes)
- Vouvoiement, ton chaleureux et professionnel, réponses courtes avec listes quand c'est une procédure.
- Elle répond **uniquement** à partir des livrets publiés du site et des compléments du site. Contacts, téléphones, prix et noms sortent tels quels du livret.
- Si l'information n'y est pas : réponse **exacte** « Je ne sais pas, désolé. », sans rien d'autre. La question est enregistrée dans `questions_sans_reponse`, rattachée au site.
- Si le livret contient « À compléter » ou une valeur manquante, elle le dit au lieu d'inventer.
- Si deux livrets se contredisent, elle cite chaque livret et ne tranche pas.
- Chaque réponse cite ses sources (livret + page), cliquables vers le Détail. Un complément est cité comme « Complément ajouté par l'administrateur ».
- Implémentation : à chaque question, envoyer en contexte tout le texte des livrets du site (≈ 50 000 caractères aujourd'hui) et les compléments, avec une consigne système reprenant les règles ci-dessus. Pas de recherche vectorielle. La fonction serveur vérifie l'accès au site avant d'appeler l'IA.

## Dépôt et analyse des livrets
- Un site peut avoir **plusieurs livrets** (« Accueil », « Conciergerie »…). Un nouveau dépôt peut remplacer un livret existant.
- Extraction côté navigateur à l'envoi : `.pptx` (JSZip : texte, tableaux, images par diapositive), `.docx` (mammoth), `.pdf` (pdf.js). PDF scanné sans texte : avertir l'utilisateur (pas d'OCR dans cette version).
- Stocker le fichier d'origine dans un bucket privé `livrets` (`{site_id}/{livret_id}/{fichier}`) et les pages dans `livret_pages` (`contenu` en blocs : titre, paragraphe, liste, tableau, étapes, image, encadré ; plus `texte_brut`).
- Une étape IA (passerelle Lovable AI) nettoie la structure, propose les titres de pages et le sommaire, **sans reformuler** le contenu. Un contrôle compare le texte retranscrit au texte extrait et signale tout écart.
- « À l'identique » : texte, tableaux, ordre, titres et images conservés ; les coordonnées personnelles ne sont jamais masquées dans l'application (seule la maquette les masque).

## Comptes et accès
- Rôles `super_admin` et `hotesse` (mêmes noms que Nova Pass). Un site = un e-mail d'accueil rattaché au site (`site_members`). Le compte d'accueil ne lit que les livrets, pages et compléments de son site (RLS). Le Super Admin lit et écrit tout.
- Connexion propre à Nova Assist pour l'instant (e-mail + mot de passe, Lovable Cloud). **Pas de lien avec Nova Pass maintenant.** Plus tard, le but est qu'on ne se reconnecte pas : prévoir une page d'accueil de session qui pourra accepter un lien à usage unique, sans l'implémenter.
- Bouton « Retour à Nova Pass » : lit l'URL dans la variable d'environnement `VITE_NOVA_PASS_URL` (vide pour l'instant). Il ouvre la page d'accès de Nova Pass. Si la variable est vide, il affiche un message discret.
- Le schéma proposé est dans `docs/schema.sql` (à adapter, jamais à copier tel quel si Lovable propose mieux ; garder les noms de tables et les règles d'accès).

## Hors périmètre
Statistiques (sauf la liste des questions sans réponse), autres langues, OCR, Serenity configurable, toute modification de Nova Pass.

## Tests d'acceptation (avec les livrets de `docs/livrets-exemples/`, site Seine Avenue)
| Question | Réponse attendue (source) |
|---|---|
| Que faire si un livreur dépose un colis à l'accueil ? | Aucun colis conservé à l'accueil, l'accueil ne signe pas, les livreurs vont aux étages ; colis coworking : annuaire, personne concernée, puis Eli (Accueil, p. 12) |
| Comment gérer un dépôt pressing ? | Les 9 étapes, de l'identification des articles à la préparation du sac, avec l'astuce photo (Conciergerie, p. 8) |
| Quel est le prix d'une chemise ? | Sur cintre 5,00 €, pliée 6,00 € (Conciergerie, p. 17) |
| Que faire en cas d'absence ? | Prévisible : prévenir 48 h avant par téléphone + écrit ; imprévue : appeler dès que possible ; arrêt maladie : volet 3 sous 48 h (Accueil, p. 21) |
| Quels sont les horaires ? | Accueil 8h00-19h00 du lundi au vendredi ; conciergerie « À compléter » dans le livret (Accueil p. 4, Conciergerie p. 4) |
| Quel est le code du wifi visiteurs ? | « Je ne sais pas, désolé. » + question créée côté Super Admin |
| Le Super Admin répond à la question du wifi, puis un compte d'accueil la repose | Serenity répond avec le complément |
| Compte d'accueil du site A ouvre un livret du site B | Refusé par la sécurité (RLS) |

Points d'attention connus dans les livrets d'exemple : adresse « 2 rue » dans le livret Conciergerie et « 4-8 rue » dans le livret Accueil Sarah Bernhardt ; mention d'un site « Le 31 » dans la clause de confidentialité. Ne pas corriger : Serenity cite chaque livret.
