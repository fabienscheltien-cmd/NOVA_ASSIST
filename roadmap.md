# Connexion Nova Store

- [x] Ajouter la vérification du jeton HMAC-SHA256 limitée à 60 secondes.
- [x] Ajouter la fonction serveur de préparation du compte, du rôle et du site.
- [x] Ajouter `/connexion-store` et sa redirection vers l'espace connecté.
- [x] Tester la validité du jeton, les droits, la route et les erreurs (29 tests).
- [ ] Vérifier un lien réel émis par Nova Store — en attente du fichier source ou d’un lien de test.

# Super Admin et livrets
- [x] Seul le Super Admin a la liste déroulante des sites (sites venant de Nova Store inclus) et attache le livret d'accueil au site choisi.
- [x] Format exact du jeton Nova Store intégré.

# Déversement des sites Nova Store
- [x] Adresse de réception signée POST /api/public/sites/sync (tests inclus).
- [x] « Créer un site » retiré de Sites et comptes.
- [ ] Côté Nova Store : envoyer chaque site créé/modifié — à faire dans le projet Nova Store.
