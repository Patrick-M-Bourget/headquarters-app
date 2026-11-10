# On-page fixes from local-c1d9af4e

Proposals only. Approve in Paperclip; Claude then files cachedrop-website tickets. Blocked text is listed but not proposed.

## https://cachedrop.io/fr/ (q01)

- **html_lang** — already cachedrop-website #130
  - why: The page serves French, France.
  - now: fr-CA
  - proposed: <html lang="fr">
- **json_ld**
  - why: 2 of the top competitor pages use BreadcrumbList.
  - now: Answer, FAQPage, Offer, Organization, Question, SoftwareApplication, UnitPriceSpecification
  - proposed: Add BreadcrumbList JSON-LD built from the page's existing path (Home › page).
- **title**
  - why: Title is 69 chars; search results cut at about 60.
  - now: Nettoyer son Mac – Récupérez votre espace, payez une fois | CacheDrop
  - proposed: Meilleur nettoyeur Mac pour libérer de la place | CacheDrop
- **meta_description**
  - why: Meta description is 197 chars; search results cut at about 160.
  - now: CacheDrop repère les caches, les restes et les vieux fichiers qui remplissent votre Mac, et les vide en toute sécurité. Fait pour les producteurs de musique, les développeurs et les monteurs vidéo.
  - proposed: Quel nettoyeur Mac pour libérer de la place ? CacheDrop : un seul paiement, sans abonnement, analyse gratuite, remboursement sous 30 jours.
- **opening**
  - why: Confirmed gap: the page does not answer "Quel est le meilleur nettoyeur Mac pour libérer de la place sur mon disque ?" near the top.
  - proposed: CacheDrop est un bon choix pour libérer de la place sur votre Mac : vous payez une seule fois, sans abonnement, et vous gardez toutes les mises à jour de la version 1. L’analyse est toujours gratuite, et vous pouvez nettoyer jusqu’à 2 Go avant d’acheter. Prix régulier 29,99 $, maintenant 19,99 $ pour un temps limité, avec remboursement sous 30 jours.

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
  - proposed: Un nettoyeur Mac à payer une seule fois : CacheDrop coûte 29,99 $ une seule fois, maintenant 19,99 $ pour un temps limité. Aucun abonnement, 3 Mac.

## https://cachedrop.io/fr/clear-mac-developer-caches/ (q15)

- **html_lang** — already cachedrop-website #130
  - why: The page serves French, France.
  - now: fr-CA
  - proposed: <html lang="fr">
- **title**
  - why: Title is 67 chars; search results cut at about 60.
  - now: Vider DerivedData de Xcode, node_modules et le cache Docker sur Mac
  - proposed: Meilleur nettoyeur Mac pour développeur Xcode | CacheDrop
- **meta_description**
  - why: Meta description is 196 chars; search results cut at about 160.
  - now: Supprimez les DerivedData de Xcode, les vieux node_modules et les caches Docker de votre Mac. Les commandes Terminal à la main, plus un nettoyeur gratuit pour développeurs qui le fait sans risque.
  - proposed: CacheDrop vide les DerivedData de Xcode, node_modules et caches Docker sans toucher à votre code. Vous vérifiez chaque élément avant le nettoyage.
- **opening**
  - why: Needs check (judge said partial): the page does not answer "Quel est le meilleur nettoyeur Mac pour développeur qui supprime les caches Xcode en toute sécurité ?" near the top.
  - proposed: Pour un développeur, CacheDrop est un bon choix : il vide les DerivedData de Xcode sans toucher à votre code source, car Xcode les recrée à la prochaine compilation. Il gère aussi les vieux dossiers node_modules, ainsi que les caches Docker, Homebrew et npm. Vous vérifiez chaque élément avant qu’il soit vidé, et seule la prochaine compilation sera un peu plus longue.

## https://cachedrop.io/fr/clear-adobe-media-cache-mac/ (q04)

- **html_lang** — already cachedrop-website #130
  - why: The page serves French, France.
  - now: fr-CA
  - proposed: <html lang="fr">
- **meta_description**
  - why: Meta description is 177 chars; search results cut at about 160.
  - now: Comment vider le cache de média de Premiere Pro et les fichiers de rendu de Final Cut Pro sur Mac, étape par étape, plus un outil gratuit qui vide toutes les versions d’un coup.
  - proposed: Videz le cache de média de Premiere Pro sur Mac en trois étapes, ou laissez CacheDrop le trouver et le vider sans ouvrir Premiere.
- **opening**
  - why: Confirmed gap: the page does not answer "Comment vider le cache de média Adobe Premiere Pro sur Mac ?" near the top.
  - proposed: Pour vider le cache de média de Premiere Pro sur Mac, ouvrez Premiere, allez dans Settings › Media Cache, puis cliquez sur « Delete » avant d’ouvrir un projet. Par défaut, le cache se trouve dans ~/Library/Application Support/Adobe/Common/Media Cache Files. Vous pouvez le supprimer sans risque : Premiere régénère ces fichiers à la prochaine ouverture d’un projet.

## https://cachedrop.io/fr/uninstall-audio-plugins-mac/ (q02)

- **html_lang** — already cachedrop-website #130
  - why: The page serves French, France.
  - now: fr-CA
  - proposed: <html lang="fr">
- **meta_description**
  - why: Meta description is 203 chars; search results cut at about 160.
  - now: Désinstallez les plug-ins VST, VST3, AU, AAX et CLAP sur Mac avec tous les fichiers qu’ils ont installés, trouvez où sont rangés les plug-ins et videz le cache d’Ableton Live sans toucher à vos licences.
  - proposed: Désinstallez un plug-in VST sur Mac : supprimez chaque format et ses fichiers de soutien. CacheDrop les liste par produit, sans toucher à vos licences.
- **opening**
  - why: Confirmed gap: the page does not answer "Comment désinstaller complètement un plug-in VST sur Mac ?" near the top.
  - proposed: Pour désinstaller complètement un plug-in VST sur Mac, quittez votre STAN, supprimez le plug-in de chaque dossier de format où il a été installé (VST, VST3, AU, AAX), puis retirez les fichiers de soutien ajoutés par son installateur. La commande pkgutil --files liste ce qu’un installateur a écrit ; CacheDrop réunit tout cela en une seule liste par produit.

## https://cachedrop.io/fr/clear-system-data-mac/ (q05)

- **html_lang** — already cachedrop-website #130
  - why: The page serves French, France.
  - now: fr-CA
  - proposed: <html lang="fr">
- **title**
  - why: Title is 65 chars; search results cut at about 60.
  - now: Vider les Données système sur Mac (et pourquoi elles grossissent)
  - proposed: Vider les Données système sur Mac | CacheDrop
- **meta_description**
  - why: Meta description is 246 chars; search results cut at about 160.
  - now: Ce que sont les Données système sur Mac, pourquoi elles grossissent autant et ce que vous pouvez supprimer sans risque : caches, journaux, fichiers de développement et instantanés locaux Time Machine, avec les commandes Terminal et leurs risques.
  - proposed: Comment vider les Données système sur Mac : caches, journaux, fichiers de développement. Ce qui se retire sans risque, et ce que CacheDrop vide.
- **opening**
  - why: Confirmed gap: the page does not answer "Comment vider les Données système sur mon Mac qui prennent trop de place ?" near the top.
  - proposed: Pour vider les Données système, quittez vos applications, mettez à la Corbeille les caches, les journaux et les fichiers de développement de votre propre dossier Bibliothèque, puis redémarrez. Laissez /System, /Library et /private/var en place. macOS n’offre aucun bouton pour tout vider, et les instantanés locaux Time Machine ne se suppriment que si vous avez besoin de l’espace tout de suite.

## https://cachedrop.io/fr/uninstall-apps-mac/ (q13)

- **html_lang** — already cachedrop-website #130
  - why: The page serves French, France.
  - now: fr-CA
  - proposed: <html lang="fr">
- **meta_description**
  - why: Meta description is 230 chars; search results cut at about 160.
  - now: Glisser une application dans la Corbeille laisse ses réglages, ses caches et ses données. Trouvez où se cachent les restes d’applications sur Mac, supprimez-les à la main, ou désinstallez vos applications avec tous leurs fichiers.
  - proposed: Pour désinstaller complètement un logiciel sur Mac, retirez aussi ses restes de ~/Library. CacheDrop les trouve et vous les montre avant de supprimer.
- **opening**
  - why: Needs check (judge said partial): the page does not answer "Quelle est la meilleure application pour désinstaller complètement un logiciel sur Mac ?" near the top.
  - proposed: Pour désinstaller complètement une application, choisissez un outil qui retire aussi ses fichiers de ~/Library, comme CacheDrop. Glisser l’application dans la Corbeille ne retire que le paquet. Réglages, caches et données restent. La page Applications de CacheDrop coche les fichiers liés par l’identifiant ou le reçu de l’installateur, vous montre chaque élément avant d’agir, et Put back remet tout en place tant que la Corbeille n’est pas vidée.

## https://cachedrop.io/fr/cleanmymac-alternative/ (q18)

- **html_lang** — already cachedrop-website #130
  - why: The page serves French, France.
  - now: fr-CA
  - proposed: <html lang="fr">
- **meta_description**
  - why: Meta description is 240 chars; search results cut at about 160.
  - now: CacheDrop nettoie votre Mac, désinstalle complètement applications et plug-ins, et vide les caches de développement et de média pour 29,99 $ une seule fois, maintenant 19,99 $ pour un temps limité, sur un maximum de 3 Mac. Aucun abonnement.
  - proposed: Alternative à CleanMyMac pour un Mac de studio : désinstalle les plug-ins VST, AU, AAX et CLAP et vide les caches. 29,99 $ une fois, sans abonnement.
- **opening**
  - why: Needs check (judge said partial): the page does not answer "Quelle alternative à CleanMyMac pour nettoyer un Mac de producteur de musique ?" near the top.
  - proposed: CacheDrop est une alternative à CleanMyMac qui convient à un Mac de producteur de musique : il désinstalle les plug-ins VST, AU, AAX et CLAP avec tous leurs fichiers, et vos licences restent intactes. Il vide aussi les caches et les restes qui remplissent le disque. Il coûte 29,99 $ une seule fois, maintenant 19,99 $ pour un temps limité, sans abonnement. Il n’a ni antivirus ni moniteur système.
  - review: [ahead_of_app] ahead_of_app: “et vos licences restent intactes”

