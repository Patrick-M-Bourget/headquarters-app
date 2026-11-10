# On-page fixes from 8ef8840f-dd1f-4175-94a7-4535945be1eb

Proposals only. Approve in Paperclip; Claude then files cachedrop-website tickets. Blocked text is listed but not proposed.

## https://cachedrop.io/fr/ (q01)

- **html_lang** — already cachedrop-website #130
  - why: The page serves French, France.
  - now: fr-CA
  - proposed: <html lang="fr">
- **title**
  - why: Title is 69 chars; search results cut at about 60.
  - now: Nettoyer son Mac – Récupérez votre espace, payez une fois | CacheDrop
  - proposed: Nettoyeur Mac pour libérer de l’espace | CacheDrop
- **meta_description**
  - why: Meta description is 197 chars; search results cut at about 160.
  - now: CacheDrop repère les caches, les restes et les vieux fichiers qui remplissent votre Mac, et les vide en toute sécurité. Fait pour les producteurs de musique, les développeurs et les monteurs vidéo.
  - proposed: Quel nettoyeur Mac pour libérer de l’espace ? CacheDrop : analyse toujours gratuite, 2 Go nettoyés avant d’acheter, un seul paiement, sans abonnement.
- **opening** — needs a decision amendment (website Decision 51)
  - why: Confirmed gap: the page does not answer "Quel est le meilleur nettoyeur Mac pour libérer de la place sur mon disque ?" near the top.
  - proposed: CacheDrop est un bon choix pour libérer de la place sur votre Mac : l’analyse est toujours gratuite et vous pouvez nettoyer jusqu’à 2 Go avant d’acheter. Ensuite, la licence coûte 29,99 $, maintenant 19,99 $ pour un temps limité, une seule fois, sans abonnement. Elle couvre jusqu’à 3 de vos Mac, avec un remboursement possible dans les 30 jours.

## https://cachedrop.io/fr/pricing/ (q24)

- **html_lang** — already cachedrop-website #130
  - why: The page serves French, France.
  - now: fr-CA
  - proposed: <html lang="fr">
- **json_ld**
  - why: 2 of the top competitor pages use BreadcrumbList.
  - proposed: Add BreadcrumbList JSON-LD built from the page's existing path (Home › page).
- **meta_description** — needs a decision amendment (website Decision 47)
  - why: Meta description is 282 chars; search results cut at about 160.
  - now: CacheDrop trouve ce qui remplit votre Mac et le nettoie en toute sécurité. La licence coûte 29,99 $ une seule fois, maintenant 19,99 $ pour un temps limité, pour un maximum de 3 Mac, avec toutes les mises à jour de la version 1 et le remboursement dans les 30 jours. Rien à annuler.
  - proposed: Un nettoyeur Mac à payer une seule fois : CacheDrop, 29,99 $ une seule fois, maintenant 19,99 $ pour un temps limité. Sans abonnement, pour 3 Mac.

## https://cachedrop.io/fr/clear-mac-developer-caches/ (q15)

- **html_lang** — already cachedrop-website #130
  - why: The page serves French, France.
  - now: fr-CA
  - proposed: <html lang="fr">
- **title**
  - why: Title is 67 chars; search results cut at about 60.
  - now: Vider DerivedData de Xcode, node_modules et le cache Docker sur Mac
  - proposed: Nettoyeur Mac pour développeur : caches Xcode | CacheDrop
- **meta_description**
  - why: Meta description is 196 chars; search results cut at about 160.
  - now: Supprimez les DerivedData de Xcode, les vieux node_modules et les caches Docker de votre Mac. Les commandes Terminal à la main, plus un nettoyeur gratuit pour développeurs qui le fait sans risque.
  - proposed: CacheDrop vide les DerivedData de Xcode, les node_modules et les caches Docker de votre Mac. Vous vérifiez chaque élément avant le nettoyage.
- **opening**
  - why: Needs check (judge said partial): the page does not answer "Quel est le meilleur nettoyeur Mac pour développeur qui supprime les caches Xcode en toute sécurité ?" near the top.
  - proposed: Pour supprimer les caches Xcode en toute sécurité, choisissez un nettoyeur Mac pour développeurs comme CacheDrop : il vide les DerivedData sans toucher à votre code source, et vous vérifiez chaque élément avant qu’il soit vidé. Xcode recrée ces fichiers automatiquement. Seule la prochaine compilation sera plus longue. CacheDrop traite aussi les vieux node_modules et les caches Docker, Homebrew et npm.

## https://cachedrop.io/fr/clear-adobe-media-cache-mac/ (q04)

- **html_lang** — already cachedrop-website #130
  - why: The page serves French, France.
  - now: fr-CA
  - proposed: <html lang="fr">
- **meta_description**
  - why: Meta description is 177 chars; search results cut at about 160.
  - now: Comment vider le cache de média de Premiere Pro et les fichiers de rendu de Final Cut Pro sur Mac, étape par étape, plus un outil gratuit qui vide toutes les versions d’un coup.
  - proposed: Vider le cache de média de Premiere Pro sur Mac : Settings › Media Cache › Delete, ou CacheDrop qui le vide sans ouvrir Premiere.
- **opening**
  - why: Confirmed gap: the page does not answer "Comment vider le cache de média Adobe Premiere Pro sur Mac ?" near the top.
  - proposed: Dans Premiere Pro, ouvrez Settings › Media Cache (Preferences › Media Cache dans les versions plus anciennes), puis cliquez sur « Delete », de préférence juste après le lancement, avant d’ouvrir un projet. Sans risque : Premiere régénère ces fichiers .cfa et .pek à la prochaine ouverture. CacheDrop peut aussi le vider pour vous, sans ouvrir Premiere.

## https://cachedrop.io/fr/uninstall-audio-plugins-mac/ (q02)

- **html_lang** — already cachedrop-website #130
  - why: The page serves French, France.
  - now: fr-CA
  - proposed: <html lang="fr">
- **meta_description**
  - why: Meta description is 203 chars; search results cut at about 160.
  - now: Désinstallez les plug-ins VST, VST3, AU, AAX et CLAP sur Mac avec tous les fichiers qu’ils ont installés, trouvez où sont rangés les plug-ins et videz le cache d’Ableton Live sans toucher à vos licences.
  - proposed: Désinstaller un plug-in VST sur Mac : quittez votre STAN, supprimez chaque format, retirez les fichiers de soutien. CacheDrop les réunit par produit.
- **opening**
  - why: Confirmed gap: the page does not answer "Comment désinstaller complètement un plug-in VST sur Mac ?" near the top.
  - proposed: Pour désinstaller complètement un plug-in VST sur Mac, quittez votre STAN, supprimez le plug-in de chaque dossier de format où il a été installé, puis retirez les fichiers de soutien que son installateur a ajoutés. La commande pkgutil --files liste ce que l’installateur a écrit. CacheDrop réunit tout cela en une seule liste par produit et met votre sélection à la Corbeille.

## https://cachedrop.io/fr/clear-system-data-mac/ (q05)

- **html_lang** — already cachedrop-website #130
  - why: The page serves French, France.
  - now: fr-CA
  - proposed: <html lang="fr">
- **title**
  - why: Title is 65 chars; search results cut at about 60.
  - now: Vider les Données système sur Mac (et pourquoi elles grossissent)
  - proposed: Vider les Données système sur Mac : que retirer | CacheDrop
- **meta_description**
  - why: Meta description is 246 chars; search results cut at about 160.
  - now: Ce que sont les Données système sur Mac, pourquoi elles grossissent autant et ce que vous pouvez supprimer sans risque : caches, journaux, fichiers de développement et instantanés locaux Time Machine, avec les commandes Terminal et leurs risques.
  - proposed: Vider les Données système sur Mac : caches, journaux et fichiers de développement à retirer, ce qu’il faut laisser, et ce que CacheDrop vide.
- **opening**
  - why: Confirmed gap: the page does not answer "Comment vider les Données système sur mon Mac qui prennent trop de place ?" near the top.
  - proposed: Pour vider les Données système, quittez vos applications, mettez à la Corbeille les caches, les journaux et les fichiers de développement de votre dossier Bibliothèque, videz la Corbeille, puis redémarrez. Laissez /System, /Library et /private/var en place : macOS en a besoin. macOS n’offre aucun bouton pour tout vider d’un coup.

## https://cachedrop.io/fr/uninstall-apps-mac/ (q13)

- **html_lang** — already cachedrop-website #130
  - why: The page serves French, France.
  - now: fr-CA
  - proposed: <html lang="fr">
- **meta_description**
  - why: Meta description is 230 chars; search results cut at about 160.
  - now: Glisser une application dans la Corbeille laisse ses réglages, ses caches et ses données. Trouvez où se cachent les restes d’applications sur Mac, supprimez-les à la main, ou désinstallez vos applications avec tous leurs fichiers.
  - proposed: Pour désinstaller complètement un logiciel sur Mac, CacheDrop retire l’application et ses fichiers liés, et chaque élément peut être remis en place.
- **opening**
  - why: Needs check (judge said partial): the page does not answer "Quelle est la meilleure application pour désinstaller complètement un logiciel sur Mac ?" near the top.
  - proposed: Pour désinstaller complètement un logiciel sur Mac, choisissez une application qui retire aussi les fichiers laissés dans la Bibliothèque : CacheDrop les trouve avec l’application, grâce à son identifiant ou au reçu de son installateur. Vous vérifiez chaque élément avant que rien ne bouge, tout va à la Corbeille, et Put back remet un élément en place tant que la Corbeille n’est pas vidée.

## https://cachedrop.io/fr/cleanmymac-alternative/ (q18)

- **html_lang** — already cachedrop-website #130
  - why: The page serves French, France.
  - now: fr-CA
  - proposed: <html lang="fr">
- **meta_description** — BLOCKED, not proposed
  - why: Meta description is 240 chars; search results cut at about 160.
  - now: CacheDrop nettoie votre Mac, désinstalle complètement applications et plug-ins, et vide les caches de développement et de média pour 29,99 $ une seule fois, maintenant 19,99 $ pour un temps limité, sur un maximum de 3 Mac. Aucun abonnement.
  - proposed: Alternative à CleanMyMac pour un Mac de musique : plug-ins VST, AU, AAX, CLAP. 29,99 $ une fois, maintenant 19,99 $ ; essai jusqu’à 2 Go.
  - review: [block] offer_not_limited: “19,99”
- **opening** — needs a decision amendment (website Decision 54)
  - why: Needs check (judge said partial): the page does not answer "Quelle alternative à CleanMyMac pour nettoyer un Mac de producteur de musique ?" near the top.
  - proposed: CacheDrop est une alternative à CleanMyMac si vous voulez surtout récupérer de l’espace disque sur un Mac de musique : il désinstalle complètement les plug-ins VST, AU, AAX et CLAP avec tous leurs fichiers, en gardant vos licences intactes. Il n’a ni antivirus ni moniteur système, et il n’y a aucun abonnement. Vous voyez tout avant que rien ne parte.
  - review: [ahead_of_app] ahead_of_app: “en gardant vos licences intactes”

