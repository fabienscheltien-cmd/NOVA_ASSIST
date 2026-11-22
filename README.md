# Nova Assist

Livret d'accueil dématérialisé des sites NOVA. Un Super Admin dépose les livrets de procédure d'un site (Word, PDF, PowerPoint), une IA les analyse et les retranscrit à l'identique dans « Détail », et l'assistante **Serenity** répond aux questions de l'accueil uniquement d'après ces livrets.

**Statut :** application complète (TanStack Start + React + Lovable Cloud). Projet Lovable : https://lovable.dev/projects/2a099c1e-de1a-4a6a-bbb5-2f2ff0c3d6df. Historique de conception : dépôt `NOVA_ASSIST`.

## Ce que fait l'application
| Onglet | Pour qui | Rôle |
|---|---|---|
| Serenity | tous | Chat. Réponses tirées des seuls livrets et compléments du site, avec sources cliquables (livret + page). Sinon, réponse exacte « Je ne sais pas, désolé. » et question transmise au Super Admin. |
| Détail | tous | Livrets retranscrits page par page (texte, tableaux, images), sommaire, téléchargement de l'original, fiches réflexes validées, compléments. |
| Livrets | Super Admin | Dépôt / remplacement / suppression, avec progression : lecture → extraction → structuration IA → contrôle de fidélité → publication → fiches réflexes et alertes IA. |
| Questions sans réponse | Super Admin | Une réponse saisie devient un complément utilisé par Serenity (le livret n'est jamais modifié). |
| Alertes IA | Super Admin | Contradictions entre livrets (adresse, horaires, prix…) et mentions « À compléter », avec extraits et liens vers les pages. |
| Fiches réflexes | Super Admin | Procédures clés résumées par l'IA, à relire, corriger et valider avant d'être visibles par l'accueil. |
| Sites et comptes | Super Admin | Création des sites et du compte d'accueil de chaque site. |

### Garde-fous IA
- Structuration : l'IA ne propose que des titres de pages et des types de blocs ; le texte extrait n'est jamais réécrit, et un contrôle de fidélité vérifie que 100 % du texte se retrouve.
- Serenity : une réponse sans source vérifiable (livret et page existants) est remplacée par « Je ne sais pas, désolé. ».
- Alertes et fiches : écartées si elles ne renvoient pas à une page réelle ; les fiches restent en brouillon jusqu'à validation.

## Mise en service (Lovable)
1. **Base de données** : demander à Lovable d'appliquer le script `docs/supabase/nova_assist_schema.sql` tel quel (tables, règles d'accès RLS, bucket privé `livrets`, rôle Super Admin automatique pour aurelie.godin@nova-serenity.fr et fabien.scheltien@nova-serenity.fr). Lovable régénère alors `src/integrations/supabase/types.ts`.
2. **Comptes Super Admin** : dans Lovable Cloud → Utilisateurs, créer les comptes des deux adresses ci-dessus (e-mail confirmé) : le rôle est attribué automatiquement.
3. **IA** : Lovable AI activé (clé `LOVABLE_API_KEY` gérée par Lovable, jamais dans le navigateur). Serenity utilise un modèle léger (`google/gemini-3.8-flash` par défaut, modifiable avec le secret `NOVA_IA_MODELE_SERENITY`) et n'envoie à l'IA que les pages utiles ; les analyses de dépôt utilisent `NOVA_IA_MODELE` (par défaut `openai/gpt-6-astra`). Vérifier les identifiants exacts dans la liste des modèles Lovable AI.

Ensuite, depuis l'application : « Sites et comptes » → créer le site et son compte d'accueil, puis « Livrets » → déposer les livrets.

## Développement
| Commande | Rôle |
|---|---|
| `bun install` | Dépendances |
| `bun run dev` / `bun run build` | Serveur local / compilation |
| `bun run test` | Tests (vitest) : extraction Word / PowerPoint / PDF, règles IA, sélection des pages |
| `bash tests/sql/lancer.sh` (utilisateur postgres) | Script de base + tests des droits d'accès sur un PostgreSQL local |
| `npx vite --config tests/apercu/vite.config.ts` | Aperçu visuel des écrans avec les livrets d'essai, sans Supabase ni IA |
| `python3 scripts/generer-livrets-test.py` | Regénère les livrets d'essai `.pptx`/`.docx` depuis `docs/livrets-exemples/` |

## Contenu
| Chemin | Rôle |
|---|---|
| `src/routes/` | Écrans (connexion, Serenity, Détail, Livrets, Questions, Alertes, Fiches, Sites) |
| `src/lib/livret/` | Extraction des livrets dans le navigateur (`.pptx`, `.docx`, `.pdf`) et contrôle de fidélité |
| `src/lib/ia/prompts.ts` | Consignes et lecture des réponses de l'IA (Serenity, structuration, alertes, fiches) |
| `src/lib/*.functions.ts` | Fonctions serveur (accès contrôlés, appels IA) |
| `docs/supabase/nova_assist_schema.sql` | Schéma et règles d'accès, à appliquer par Lovable |
| `LOVABLE_PROMPT.md`, `docs/` | Cahier de construction, design validé, maquette, visuel de référence, livrets d'exemple |

## Règles
- Nova Assist est indépendant de Nova Pass (aucun lien entre les deux).
- Dépôt privé : les livrets d'exemple contiennent des coordonnées professionnelles réelles.
