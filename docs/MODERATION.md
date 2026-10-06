# Guide de modération — EduTube

Destinataires : administrateurs de la plateforme (cellule pédagogique numérique du MEN, SIMEN, correspondants désignés dans les IA/IEF). Ce guide décrit les responsabilités, les procédures et les critères de décision. La charte communautaire (`docs/CHARTE.md`, page `/charte`) constitue la référence opposable aux utilisateurs.

## 1. Principes

1. **Seuls les administrateurs publient.** Aucun contenu proposé par un enseignant ou un élève n'est visible avant validation explicite.
2. **Toute décision négative est motivée** et transmise au contributeur (rejet de proposition, masquage, suspension). La motivation est pédagogique et respectueuse : elle indique comment corriger et resoumettre.
3. **Traçabilité** : chaque action est consignée (historique des décisions + journal d'audit). Les exports CSV servent aux bilans.
4. **Proportionnalité** : avertir avant de sanctionner, masquer avant de supprimer, suspendre avant de clôturer.
5. **Protection des mineurs** : vigilance maximale sur le droit à l'image, les données personnelles et les interactions entre élèves.

## 2. Rôles et organisation

| Rôle | Qui | Responsabilités |
|---|---|---|
| Administrateur éditorial | Cellule pédagogique numérique (MEN) | Valide/rejette les propositions, publie, vérifie la conformité aux programmes, gère les chaînes officielles |
| Administrateur modération | Cellule communication / correspondants | Traite les signalements, modère les commentaires, gère les comptes |
| Administrateur technique | SIMEN | Comptes, référentiels, quotas, file de traitement, sauvegardes |

Un même compte peut cumuler les rôles ; dans l'application, tous sont « Administrateur ». Prévoir au moins deux administrateurs actifs et un relais par académie (IA) pour les signalements locaux.

**Délais cibles** : accusé automatique immédiat ; décision sur proposition sous **5 jours ouvrés** ; traitement d'un signalement de contenu sous **48 h**, d'un signalement de harcèlement ou de contenu illicite sous **24 h** (masquage conservatoire immédiat).

## 3. Workflow des propositions (enseignants / élèves)

Écran : *Administration → Propositions à valider*.

1. Une notification (cloche + e-mail si SMTP) avertit les administrateurs de chaque nouvelle proposition.
2. Examiner la fiche : titre, description, classe, discipline, thématique, langue, pièce jointe ou lien, auteur (rôle, établissement, région).
3. Vérifier la grille §5. Si un fichier est joint, le télécharger via le lien de la proposition (pièces jointes non exposées publiquement) ou l'écouter/visionner localement.
4. **Approuver** (note facultative) : si un fichier est joint, le média est créé automatiquement (contributeur crédité, chaîne officielle par défaut, licence CC BY-NC-SA 4.0), transcodé puis publié ; sinon, téléverser le contenu depuis *+ Téléverser* en renseignant l'auteur pédagogique. Compléter ensuite les métadonnées (chapitre, mots-clés, niveau, transcription) depuis la fiche du contenu.
5. **Rejeter** : motif obligatoire (≥ 5 caractères), formulé de façon constructive. Exemples :
   - « Qualité sonore insuffisante (bruit de fond). Merci de réenregistrer dans un lieu calme et de joindre la fiche de séquence. »
   - « Visages d'élèves identifiables : une autorisation parentale de droit à l'image est requise avant toute publication. Vous pouvez resoumettre avec les autorisations ou une version floutée. »
   - « Le contenu ne correspond pas au programme de la classe indiquée (notion de 4e). Merci de reclasser en 4e ou d'adapter. »
6. Le contributeur est notifié ; il peut resoumettre une proposition corrigée.

## 4. Workflow des contenus publiés

Écran : *Administration → Contenus*.

| Action | Effet | Quand |
|---|---|---|
| Publier | Visible par tous ; notification aux abonnés de la chaîne et au contributeur | brouillon prêt, contenu archivé à remettre en ligne |
| Archiver | Retiré de la diffusion, conservé, restaurable | contenu obsolète (nouveau programme), doublon, signalement fondé non grave |
| Rejeter | Statut « Rejeté » avec motif, contributeur notifié | contenu non conforme après publication, droits d'auteur |
| Restaurer / retraiter | Retour en brouillon (relance du transcodage si nécessaire) | après correction |
| Supprimer | Suppression définitive (fichiers inclus) | contenu illicite, demande légale ; exceptionnel |
| Remplacer miniature / sous-titres | Mise à jour immédiate | accessibilité, visuel inadapté |

## 5. Grille de validation d'un contenu

Un contenu est publié s'il satisfait **tous** les critères suivants :

**Pédagogie**
- Conforme aux programmes officiels du niveau indiqué (cycle, classe, discipline, chapitre) ; exactitude scientifique et linguistique.
- Objectifs identifiables ; durée adaptée au public (primaire ≤ 10 min recommandé).
- Métadonnées complètes : titre explicite avec la classe, description, mots-clés, auteur pédagogique, langue, niveau de difficulté, licence.

**Qualité technique**
- Son intelligible (normalisé automatiquement), image stable et lisible (≥ 480p recommandé), pas de coupure.
- Sous-titres fournis pour la vidéo dès que possible ; transcription pour l'audio (accessibilité et recherche).

**Droit et éthique**
- Auteur identifié et autorisation de diffusion ; musiques/images libres de droits ou sous licence compatible.
- Aucune personne identifiable sans autorisation écrite (mineurs : autorisation parentale) ; aucune donnée personnelle (numéros, adresses).
- Neutralité : pas de promotion commerciale, politique ou confessionnelle ; respect des valeurs de la République et de la charte.

**Refus systématiques** : contenus violents, haineux, sexuels, discriminatoires ; incitation à la tricherie (sujets d'examen en cours) ; contrefaçon ; contenu hors éducation.

## 6. Signalements

Écran : *Administration → Signalements*. Motifs : contenu inapproprié, erreur pédagogique, droits d'auteur, harcèlement, spam, autre.

Procédure :
1. Lire le signalement et ouvrir la cible (média ou commentaire) depuis la fiche.
2. Mesure conservatoire si doute sérieux (harcèlement, contenu choquant) : **masquer le commentaire** ou **archiver le média** immédiatement (action « HIDE_TARGET » lors du traitement, ou depuis la fiche).
3. Décider : **Fondé — traité** (avec action éventuelle) ou **Non fondé — classé** ; rédiger une note de résolution.
4. Pour une erreur pédagogique avérée : archiver, demander une correction à l'auteur, republier la version corrigée.
5. Pour un harcèlement entre élèves : masquer, avertir l'auteur (message via recommandation/notification ou établissement), informer l'établissement ; suspendre en cas de récidive.
6. Signalements manifestement abusifs répétés : avertissement au signalant, puis suspension.

## 7. Commentaires

Écran : *Administration → Commentaires* (tous, en attente, visibles, masqués) ; actions aussi disponibles sur chaque page de contenu pour les administrateurs.

- Par défaut les commentaires sont publiés immédiatement ; le paramètre `moderation.commentsRequireApproval=true` impose une validation préalable (recommandé en période d'examens ou après incident).
- Masquer (motif conseillé) plutôt que supprimer, sauf données personnelles ou contenu illicite (supprimer).
- Quota : `quota.comment.maxPerHour` (30 par défaut) limite le spam.

## 8. Comptes

Écran : *Administration → Utilisateurs*.

| Mesure | Usage |
|---|---|
| Avertissement | premier manquement mineur (message via l'établissement ou notification) |
| Suspension | manquements répétés, harcèlement, usurpation ; le compte ne peut plus se connecter, ses contenus restent |
| Réactivation | après engagement de l'utilisateur / décision de l'établissement |
| Changement de rôle | passage enseignant → administrateur (décision MEN), correction d'inscription |
| Réinitialisation de mot de passe | à la demande de l'établissement/IEF, après vérification d'identité |

Ne jamais communiquer un mot de passe par un canal non sécurisé ; utiliser un mot de passe temporaire et demander le changement immédiat (*Mon profil*).

## 9. Journalisation et bilans

- *Journal d'audit* : connexions, publications, modifications, décisions, exports (acteur, date, IP).
- *Décisions de modération* : onglet dédié (approbations, rejets, masquages, archivages, suspensions, avec motifs).
- Bilan trimestriel recommandé : nombre de propositions (par statut, par académie), délais moyens, signalements par motif, contenus publiés par cycle/discipline (exports CSV).

## 10. Modèles de messages

**Accusé de réception (automatique)** : « Votre proposition “…” a bien été reçue. Elle sera examinée par la cellule pédagogique numérique sous 5 jours ouvrés. »

**Approbation** : « Merci pour votre contribution ! Votre contenu “…” est publié sur la chaîne officielle. Il est crédité à votre nom comme auteur pédagogique. »

**Rejet** : « Merci pour votre proposition “…”. Elle n'a pas pu être retenue pour le motif suivant : …. Vous pouvez la corriger et la soumettre à nouveau depuis Mon espace → Mes propositions. »

**Avertissement** : « Un de vos commentaires sur “…” a été masqué car il ne respecte pas la charte communautaire (motif : …). Nous comptons sur vous pour des échanges respectueux et constructifs. »

**Suspension** : « Votre compte est suspendu suite à des manquements répétés à la charte communautaire (…). Vous pouvez demander un réexamen auprès de votre établissement ou de votre IEF. »
