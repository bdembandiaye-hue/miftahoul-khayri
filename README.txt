DAHIRA MIFTAHOUL KHAYRI
========================

EMPLACEMENT DEMANDE PAR L'UTILISATEUR
C:\Users\hp\Desktop\MIFT\projet khayri

CONTENU
- index.html : accueil
- historique.html : historique
- xam-sa-dine.html : PDF Tazawoudou Sikhar, Massalikoul Jinane, Tazawoudou Choubane
- actualites.html : photos et audios
- evenements.html : activités et événements
- contact.html : contact
- admin.html : administration
- server.js : backend Express
- data/content.json : données
- public/uploads/pdf : PDF
- public/uploads/photos : photos
- public/uploads/audios : audios

INSTALLATION WINDOWS
1. Ouvrir PowerShell ou CMD.
2. Aller dans le dossier :
   cd "C:\Users\hp\Desktop\MIFT\projet khayri"
3. Installer les dépendances :
   npm install
4. Démarrer le site :
   npm start
5. Ouvrir :
   http://localhost:3000
6. Administration :
   http://localhost:3000/admin.html

COMPTE ADMIN INITIAL
Utilisateur : admin
Mot de passe : admin123

IMPORTANT : changer le mot de passe avant une mise en ligne publique.

POUR LES PDF
Dans Administration > Ajouter un contenu > PDF - Xam sa diné.
Titre : Tazawoudou Sikhar / Massalikoul Jinane / Tazawoudou Choubane.
Puis sélectionner le PDF.

POUR UN EVENEMENT
Choisir Événement, saisir titre/date/heure/lieu/description et éventuellement une photo.

Le système stocke les informations dans data/content.json et les fichiers dans public/uploads.

FORMULAIRE DE CONTACT (nouveau)
- Page contact.html : prénom, nom, téléphone (+221), email, ville, âge,
  moyen de recontact, "Souhaitez-vous intégrer le Daara ?" (si Oui : pourquoi,
  contributions, disponibilités), objet, suggestions, message, source.
- Les demandes sont enregistrées dans data/messages.json (privé, non public).
- Consultation : admin.html > "Messages du formulaire" (appeler, WhatsApp,
  marquer lu, supprimer, export Excel CSV).

=====================================================
MISE EN LIGNE SUR RENDER (+ SUPABASE)
=====================================================
En local (sans .env) : le site utilise data/*.json et public/uploads (comme avant).
En ligne : Supabase stocke la base ET les fichiers (Render gratuit efface le disque).

1) SUPABASE (https://supabase.com)
   - New project (région : Europe / Frankfurt)
   - SQL Editor > New query > coller supabase.sql > Run
   - Project Settings > API : copier "Project URL" et la clé "service_role"
     (la clé service_role est SECRÈTE : jamais dans le code ni sur GitHub)

2) GITHUB
   git init
   git add .
   git commit -m "Site Dahira Miftahoul Khayri"
   git branch -M main
   git remote add origin https://github.com/TON-COMPTE/dahira-khayri.git
   git push -u origin main

3) RENDER (https://render.com)
   - New > Blueprint > choisir le dépôt GitHub (render.yaml est détecté)
   - Remplir : ADMIN_PASSWORD, SUPABASE_URL, SUPABASE_SERVICE_KEY
   - Deploy. Vérifier : https://TON-SITE.onrender.com/api/health
     -> {"ok":true,"storage":"supabase"}

Mises à jour : git add . ; git commit -m "..." ; git push  -> Render redéploie seul.
Note : en gratuit, le site "s'endort" après 15 min sans visite (1er chargement ~30-50 s).
