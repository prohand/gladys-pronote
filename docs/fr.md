# PRONOTE pour Gladys

Cette intégration amène **PRONOTE**, le logiciel de vie scolaire de la plupart des
établissements français, dans Gladys : notes, devoirs, emploi du temps, absences,
carnet de correspondance et messages non lus d'un élève — ou de chaque enfant d'un compte parent.

Elle lit PRONOTE comme le fait l'application PRONOTE, toutes les quelques minutes,
et publie ce qu'elle trouve sous forme d'appareils Gladys, de déclencheurs de
scènes et de widgets de tableau de bord.

> PRONOTE et Index Éducation ne sont pas impliqués dans cette intégration. Elle
> utilise la bibliothèque libre [pawnote](https://github.com/LiterateInk/Pawnote.js)
> pour dialoguer avec PRONOTE.

## Prérequis

- Gladys **5.3 ou plus récent**.
- Un compte PRONOTE **élève** ou **parent** (les comptes enseignants ne sont pas
  pris en charge).
- L'adresse de votre espace PRONOTE, telle que l'affiche votre navigateur, par
  exemple `https://0123456a.index-education.net/pronote/`.

## Configuration

Dans Gladys, ouvrez **Intégrations → PRONOTE → Configuration**.

| Champ                                | Quoi mettre                                                                                                                                                       |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Adresse PRONOTE                      | L'adresse de l'espace PRONOTE. La fin (`eleve.html`, `parent.html`) n'est pas nécessaire.                                                                         |
| Type de compte                       | **Élève** pour un compte élève, **Parent** pour un compte parent (un appareil par enfant).                                                                        |
| Identifiant / Mot de passe           | Votre identifiant et votre mot de passe PRONOTE.                                                                                                                  |
| Intervalle de rafraîchissement (min) | Fréquence de lecture de PRONOTE. 30 minutes suffisent ; le serveur est partagé par tout l'établissement.                                                          |
| Horizon des devoirs                  | Nombre de jours de devoirs comptés et listés, à partir du prochain jour de cours (7 par défaut). Pendant les vacances, les jours comptent à partir de la rentrée. |
| Fuseau horaire de l'établissement    | `Europe/Paris` par défaut. Outre-mer : `Indian/Reunion`, `America/Martinique`, `Pacific/Noumea`…                                                                  |
| Journaux détaillés                   | À activer pour comprendre un problème, puis à désactiver.                                                                                                         |

Enregistrez, puis appuyez sur **Tester la connexion** : elle indique qui est
connecté et ce qui a été trouvé pour chaque élève.

Après la première connexion, PRONOTE donne à l'intégration un **jeton de session**
qui remplace le mot de passe pour les connexions suivantes, comme le fait
l'application mobile PRONOTE. Il est gardé dans le stockage propre à l'intégration.

### Comptes qui se connectent par un ENT

Si vous accédez à PRONOTE par l'ENT de votre région (Mon Bureau Numérique, ENT77,
Skolengo…), vous n'avez pas de mot de passe PRONOTE. Utilisez un **QR code** :

1. Dans PRONOTE, sur un ordinateur, ouvrez le menu à côté de votre nom et
   choisissez **QR code pour l'application mobile**. Choisissez un code à 4
   chiffres.
2. Scannez le QR code avec l'appareil photo du téléphone (pas avec l'application
   PRONOTE) : le téléphone affiche un texte qui commence par `{"jeton"`.
   Copiez-le.
3. Dans Gladys, appuyez sur **Se connecter avec un QR code**, collez le texte et
   saisissez le code à 4 chiffres. Faites vite : le QR code n'est valable que
   quelques minutes.

Laissez vides les champs adresse, identifiant et mot de passe, ou ne renseignez que
l'adresse. La session est ensuite gardée comme après une connexion par mot de passe.

## Appareils

Appuyez sur **Découvrir** (ou attendez la première lecture) pour voir les
appareils, puis créez-les.

**Un appareil par élève** :

| Fonctionnalité                   | Valeur                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------ |
| Overall average                  | La moyenne générale de la période en cours, sur 20 (quand l'établissement l'affiche).      |
| Homework to do                   | Les devoirs pas encore faits, à rendre dans l'horizon des devoirs.                         |
| Homework for the next school day | Les devoirs pas encore faits, pour le prochain jour de cours.                              |
| Absences (period)                | Les absences de la période en cours.                                                       |
| Delays (period)                  | Les retards de la période en cours.                                                        |
| Next lesson                      | Texte, par exemple `14:00 MATHEMATIQUES (B12)` (avec la date si ce n'est pas aujourd'hui). |
| Next school day start            | Texte, par exemple `08:00` : le premier cours maintenu du prochain jour de cours.          |
| Last grade                       | Texte, par exemple `MATHEMATIQUES 15/20 (12/10)`.                                          |

Les noms des fonctionnalités sont en anglais à la création ; vous pouvez les
renommer dans Gladys.

**Un appareil pour le compte** : le nombre de **messages non lus**.

Les appareils sont en lecture seule : rien n'est modifié dans PRONOTE.

## Scènes

### Déclencheurs

| Déclencheur                                       | Quand                                                                                           | Variables                                                                                                                   |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Une nouvelle note est publiée                     | Une note est apparue depuis la lecture précédente.                                              | nom de l'élève, matière, note, sur, note sur 20, note telle qu'écrite, coefficient, moyenne de la classe, commentaire, date |
| Un nouveau devoir est donné                       | Un devoir est apparu ou a changé.                                                               | nom de l'élève, matière, description, pour le                                                                               |
| Un cours est annulé                               | Un cours des prochains jours est désormais annulé.                                              | nom de l'élève, matière, date, heure de début, heure de fin, statut PRONOTE                                                 |
| Une absence ou un retard est saisi                | L'établissement a saisi une absence ou un retard.                                               | nom de l'élève, type (`absence` / `delay`), date, justifié (`yes` / `no`), minutes de retard, motif                         |
| Un mot est écrit dans le carnet de correspondance | Un professeur ou l'établissement a écrit un mot (observation, encouragement, défaut de carnet). | nom de l'élève, type (`issue` / `observation` / `encouragement` / `other`), intitulé, matière, commentaire, date            |

Chaque déclencheur peut être limité à un élève. La première lecture après
l'installation ne fait que mémoriser ce qui existe déjà : rien n'est annoncé pour
les notes des semaines passées.

### Actions

- **Lire PRONOTE maintenant** : met à jour appareils et widgets tout de suite. Les
  nouveautés trouvées sont annoncées par les déclencheurs à la lecture programmée
  suivante.
- **Obtenir la journée d'un élève** : pour aujourd'hui, demain ou le prochain jour
  de cours, donne le nombre de cours, le début du premier, la fin du dernier, les
  matières annulées, et les devoirs à faire sous forme de liste prête à être lue à
  voix haute.

Exemple : _chaque jour de semaine à 07:00 → Obtenir la journée d'un élève
(prochain jour de cours) → Dire « Premier cours à {{first_lesson}}. Devoirs :
{{homework_text}} »_.

## Widgets

- **Élève PRONOTE** : le résumé. Moyenne, devoirs à faire, absences, prochain
  cours, prochain jour de cours (seulement s'il n'est pas déjà le prochain cours),
  dernière note et messages non lus. Un bouton **Actualiser** relit PRONOTE. Son
  réglage **Liste** (**Aucune** par défaut) peut ajouter une des listes ci-dessous.

- **Devoirs PRONOTE** : les devoirs de l'horizon des devoirs, chacun marqué
  **Fait**, **Non fait**, **Aujourd'hui** ou **Demain**, comme dans PRONOTE, sous
  une tuile **À faire**.

- **Notes PRONOTE** : la moyenne et les notes les plus récentes, avec la moyenne
  de la classe. Son réglage **Nombre de notes** va de 1 à 8 (8 par défaut) : une
  liste Gladys contient 8 lignes au plus.

- **Carnet PRONOTE** : les mots des professeurs et de l'établissement
  (observations, encouragements, défauts de carnet) de la période en cours.

- **Emploi du temps PRONOTE** : les cours d'aujourd'hui, de demain ou du prochain
  jour de cours, avec les cours annulés et les contrôles signalés. Son réglage
  **Jours affichés** (1 par défaut) l'élargit à une période de 8 jours au plus à
  partir de ce jour : une ligne par jour, avec ses horaires et ses matières, et
  les cours quand on ouvre la ligne. **Aujourd'hui** et **8** montrent
  d'aujourd'hui à J+7. Les jours sans cours (week-end, vacances) sont omis.
  Son réglage **Décalage** (0 par défaut) le repousse de 1 à 7 jours de cours.
  Pour un emploi du temps comme sur papier, une colonne par jour, ajoutez le
  widget une fois par jour et placez-les côte à côte : **Prochain jour de cours**
  avec un **Décalage** de 0, 1, 2, 3 et 4 montre les cinq prochains jours de
  cours, sans les week-ends ni les vacances.

Chaque widget a un réglage **Élève** : ajoutez un widget par enfant. Tous
affichent la dernière lecture : ouvrir un tableau de bord n'interroge
jamais PRONOTE.

## Boutons de l'écran de configuration

- **Tester la connexion** : lit PRONOTE et dit ce qui a été trouvé, ou pourquoi
  pas.
- **Se connecter avec un QR code** : voir plus haut.
- **Oublier la session enregistrée** : supprime le jeton de session enregistré
  (pour changer de compte, ou après un changement de mot de passe ailleurs).

## Dépannage

| Message                                             | Que faire                                                                                                                                                                                                                                    |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PRONOTE a refusé l'identifiant ou le mot de passe   | Vérifiez-les sur le site PRONOTE. La lecture est suspendue jusqu'à l'enregistrement de la configuration ou un test.                                                                                                                          |
| PRONOTE demande de configurer la sécurité           | Connectez-vous une fois dans l'application ou le site PRONOTE pour la terminer (nouveau mot de passe, PIN), puis utilisez le QR code.                                                                                                        |
| L'adresse IP a été suspendue                        | Trop d'échecs de connexion ou de requêtes : la prochaine lecture attend une heure, le bouton Actualiser et l'action de scène aussi. N'utilisez pas « Tester la connexion » d'ici là.                                                         |
| PRONOTE a fermé la session juste après la connexion | PRONOTE a refusé une page à ce compte et a fermé la session. La prochaine lecture attend une heure, comme après une suspension, pour ne pas multiplier les connexions. Envoyez les journaux de l'intégration au développeur si cela revient. |
| Le serveur est injoignable                          | Vérifiez l'adresse. Un serveur occupé est réessayé à la lecture suivante.                                                                                                                                                                    |

Activez **Journaux détaillés** pour voir chaque étape dans les journaux de
l'intégration. Les mots de passe et jetons ne sont jamais journalisés.

## Limites connues

- Les **comptes enseignants** ne sont pas pris en charge.
- PRONOTE n'a pas de notifications : les nouveautés sont trouvées à chaque lecture,
  une nouvelle note apparaît donc dans l'intervalle de rafraîchissement.

## Vos données

Le mot de passe reste dans la configuration secrète de Gladys. Le jeton de session
est gardé dans le stockage privé de l'intégration ; notes, devoirs et emploi du
temps ne sont gardés qu'en mémoire et publiés dans votre Gladys. Rien n'est envoyé
ailleurs.
