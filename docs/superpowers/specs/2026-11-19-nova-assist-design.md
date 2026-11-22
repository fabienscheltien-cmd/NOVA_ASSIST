# Nova Assist — livret d'accueil dématérialisé (design)

Statut : validé par l'utilisateur, maquette validée (docs/maquette). Date : 2026-11-19.

## Intention
Nova Assist est une page complémentaire de Nova Pass. Le Super Admin dépose les livrets de procédure d'un site (Word, PDF ou PowerPoint). Une IA les analyse, les retranscrit fidèlement dans une rubrique « Détail », et Serenity (assistante fixe, ton chaleureux et professionnel, vouvoiement) répond aux questions de l'accueil à partir de ces seuls livrets. Objectif : que l'hôtesse trouve la bonne procédure sans chercher dans le livret.

## Objectifs
- Plusieurs livrets par site (ex. « Accueil », « Conciergerie »), chacun avec un titre. Formats : .docx, .pdf, .pptx.
- Rubrique « Détail » : texte, titres, tableaux et images fidèles à l'original, par page/diapositive, plus le fichier d'origine téléchargeable.
- Chat principal : Serenity répond en français uniquement d'après les livrets du site de l'utilisateur, en citant le livret et la page source. Les contacts viennent uniquement des livrets.
- Si la réponse n'est pas dans les livrets, Serenity répond exactement : « Je ne sais pas, désolé. » La question est stockée et rattachée au site côté Super Admin.
- Le Super Admin voit les questions sans réponse par site, saisit la réponse, qui devient un « Complément » consulté par Serenity (le livret d'origine reste intact).
- Accès : le compte d'accueil d'un site (e-mail rattaché au site) ne voit que les livrets de son site. Même modèle que Nova Pass : rôles `super_admin` et `hotesse`, 1 site = 1 e-mail d'accueil.
- Bouton « Retour à Nova Pass » : ouvre la page d'accès de Nova Pass (URL en paramètre, renseignée plus tard).
- Données personnelles hébergées sur Lovable Cloud.

## Non-objectifs
- Aucune modification de Nova Pass, aucun lien technique avec lui pour l'instant.
- Pas de statistiques, sauf la liste des questions sans réponse.
- Pas d'autres langues que le français. Serenity est statique (une seule image, un seul nom).

## Anti-objectifs (échec même si « ça marche »)
- Serenity invente une procédure, un prix, un nom ou un numéro absent des livrets.
- Une hôtesse voit le livret d'un autre site.
- La rubrique « Détail » diffère de l'original (texte tronqué, tableau perdu).

## Approches considérées
- **A. Projet séparé, même pile que Nova Pass (retenue, recommandée).** Rapide, respecte « ne touche pas à Nova Pass », fusion ultérieure facile.
- B. Module dans Nova_PASS : écarté, contraire à la consigne.
- C. Seulement un prompt Lovable : écarté, non testable par moi.

## Choix techniques (mes choix, à corriger)
- Pile : TanStack Start + React + Tailwind, Lovable Cloud (Supabase : base, stockage, auth), IA via la passerelle Lovable AI, comme Nova Pass (clé `LOVABLE_API_KEY` côté serveur, jamais exposée au navigateur).
- Extraction à l'envoi : .pptx lu dans le navigateur (JSZip : texte, tableaux, images par diapositive), .docx via mammoth, .pdf via pdf.js (PDF scanné : pas d'OCR dans cette version, message d'avertissement).
- Analyse IA : nettoie la structure, produit titres de rubriques et sommaire, sans reformuler le contenu. Contrôle automatique : le texte de « Détail » doit contenir le texte extrait.
- Chat : tous les livrets du site (volume actuel ≈ 50 000 caractères, soit environ 15 000 jetons) et les compléments sont envoyés à chaque question, avec consigne stricte « réponds uniquement avec ces documents, sinon : Je ne sais pas, désolé. ». Pas de recherche vectorielle nécessaire à cette taille.
- Données : tables `sites`, `profiles`/`user_roles` (mêmes noms que Nova Pass), `livrets`, `livret_pages`, `questions_sans_reponse`, `complements`. RLS : l'accueil ne lit que son site, le Super Admin lit tout.
- Design : thème sombre marine et doré, verre dépoli, fond ville au crépuscule, style du visuel fourni et des assets Nova Pass.
- Test : les deux livrets fournis (Conciergerie et Accueil, site Seine Avenue) servent de jeu d'essai.

## Points ouverts, laissés au constructeur
- Pas de connexion unique (SSO) tant qu'on ne touche pas à Nova Pass. Le lien plus tard exigera soit la même base d'authentification, soit un lien à usage unique émis par Nova Pass. Décision reportée.
- Mise en page exacte des écrans, gestion des erreurs d'extraction.

## Risques notés
- Incohérences dans les livrets (adresse « 2 rue » dans l'un, « 4-8 rue » dans l'autre ; mention d'un site « Le 31 » et de la Foncière SISIMMO) : Serenity répondra d'après le livret cité, et le Super Admin doit les corriger à la source.
- PDF scannés non lus sans OCR.
