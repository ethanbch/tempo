# Tempo

Tableau de bord local de ton usage de Claude Code : coût équivalent API, tokens,
efficacité du cache, fenêtres de quota, répartition par modèle et par projet.

Conçu pour les abonnés **Claude Pro et Max**.

```bash
npm install
npm run dev      # http://localhost:3000
```

## Pourquoi c'est une application locale

Il n'existe pas d'OAuth public « Se connecter avec Claude » pour les comptes
claude.ai grand public, ni d'API publique permettant de lire l'usage d'un compte
personnel. Les API d'usage et de coût d'Anthropic sont réservées aux
**organisations** (clé Admin de Claude Console, ou clé Analytics de Claude
Enterprise) : un abonnement Pro ou Max n'y donne pas accès.

La seule source de données réelle pour un abonné individuel est donc locale : les
transcripts que Claude Code écrit dans `~/.claude/projects/**/*.jsonl`. Tempo les
lit sur place. Rien n'est envoyé sur le réseau, et il n'y a pas d'écran de
connexion — le compte affiché est celui de la session Claude Code déjà présente
sur la machine, lu dans `~/.claude.json`.

Corollaire : Tempo couvre **Claude Code**, pas les conversations sur claude.ai,
qui ne laissent aucune trace locale.

## Ce que mesure le coût

Un abonnement Pro ou Max n'est pas facturé au token. Le montant affiché est ce
que le même usage aurait coûté à l'API aux tarifs publics : il mesure la valeur
consommée, pas une dépense réelle.

Le calcul se fait en deux temps, parce qu'aucune des deux sources disponibles
n'est complète à elle seule :

1. **Les requêtes visibles.** Chaque message assistant du transcript porte son
   `usage`, auquel on applique la grille tarifaire (`src/lib/pricing.ts`). Deux
   pièges s'y cachent : une réponse s'étale sur **plusieurs lignes qui répètent
   toutes le même `usage`** — la clé de facturation est l'identifiant du message
   API, pas celui de la ligne — et une session reprise peut réécrire ses messages
   dans un autre fichier.
2. **La calibration.** Claude Code passe aussi des appels facturés qu'il ne
   journalise pas : génération de titres, compaction de contexte, tâches
   utilitaires. En fin de session il écrit en revanche un enregistrement
   `cost-state` qui, lui, totalise tout. Le rapport entre les deux donne un
   facteur par session — mesuré entre 1,00 et 1,26 sur des sessions réelles,
   médiane 1,11 — appliqué au prorata de chaque requête visible.

Répartir plutôt que d'additionner un forfait garde les graphiques cohérents avec
le total, et rend le filtre de période juste. Une session encore ouverte n'a pas
encore de `cost-state` : son facteur vaut 1 et son coût est un plancher. Le pied
de page indique en permanence quelle part du total est calibrée.

### Vérifier la tarification

```bash
npm run verify:pricing
```

Le script rejoue les messages précédant chaque `cost-state` et rapporte le
facteur de calibration obtenu, plutôt qu'un écart : l'écart est structurel et
attendu. Il n'échoue que si un facteur sort de la plage plausible, ce qui
signalerait un tarif faux ou une double comptabilisation. Les sessions sans appel
utilitaire donnent un facteur de 1,000 au dix-millième — la meilleure preuve que
la grille tarifaire est exacte. Les modèles absents des transcripts (les appels
utilitaires en Haiku) sont signalés comme non réconciliables.

## Rafraîchissement

Le tableau de bord se met à jour **toutes les 30 secondes**, et au chargement de
la page. Aucun appel réseau sortant : la seule requête est celle du navigateur
vers ton propre serveur local.

Comme ça tourne en fond, trois garde-fous encadrent le coût :

- **Rien ne part quand l'onglet n'est pas visible.** Vérifié en conditions
  réelles : onglet en arrière-plan pendant 61 s, zéro requête. Au retour sur
  l'onglet, on rattrape — mais seulement si les données ont plus de 30 secondes,
  sinon alterner entre deux onglets déclencherait une rafale.
- **Jamais deux requêtes en parallèle**, et un changement de période annule le
  rafraîchissement en vol.
- **Une erreur de fond est silencieuse** : le rendu précédent reste à l'écran.

Côté serveur, deux niveaux de réutilisation. Une empreinte du disque — chemin,
taille et date de modification de chaque fichier — court-circuite tout quand rien
n'a bougé ; c'est le cas courant, et le travail se réduit à un `stat` par
fichier. Quand un transcript a grossi, il n'est relu **qu'à partir de son dernier
octet analysé** : les transcripts ne font que croître par ajout en fin de
fichier, donc une session active ne coûte que ses nouvelles lignes.

Mesuré sur un corpus de 17 Mo (14 transcripts) :

| Situation | Durée |
| --- | --- |
| Premier scan, analyse complète | 100 ms |
| Rafraîchissement sans nouveauté | 4 ms |
| 40 nouvelles lignes, lecture incrémentale | 4 ms |

Sans lecture incrémentale, la troisième ligne coûterait les 100 ms de la
première : le gain est d'environ **25×** dès qu'une session est active. La
mémoire est stable — 200 rafraîchissements consécutifs, soit 100 minutes de
fonctionnement, sans croissance monotone.

L'égalité entre lecture incrémentale et analyse complète est vérifiée : en
amputant un transcript de 300 lignes puis en les rendant, le rapport obtenu par
ajout incrémental est identique à celui d'un processus neuf analysant tout.

## Leviers d'optimisation

Le tableau de bord ne se contente pas de compter : il dérive des mêmes requêtes
ce sur quoi tu peux réellement agir, en reprenant la distinction de la méthode
d'optimisation de coût d'Anthropic.

**Gains sans contrepartie** — ils baissent la dépense sans toucher à la qualité :

- **Contexte repayé après une pause.** Une entrée de cache expire après une heure
  d'inactivité. Reprendre une session longue après une pause fait réécrire tout
  son contexte au tarif d'écriture (2× l'entrée). Chaque écriture de cache est
  attribuée à sa cause en rejouant les sessions : ouverture, croissance normale,
  reprise après expiration, changement de modèle, changement d'effort.
- **Cache invalidé en cours de session.** Changer de modèle ou de niveau d'effort
  au milieu d'une session invalide le cache et fait repayer l'historique entier.
- **Contexte au-delà du seuil de confort.** Chaque tour renvoie tout
  l'historique : le coût d'une session croît à peu près comme le carré du nombre
  de tours.
- **Coût des sous-agents**, quand il y en a.

**Arbitrages** — ils échangent du coût contre de l'intelligence, et ne
s'appliquent pas d'office : niveau d'effort (avec la part des tokens de sortie
consacrée au raisonnement) et répartition entre modèles.

### Deux règles d'honnêteté dans les chiffres

**Un arbitrage n'affiche jamais une économie.** Pour ces leviers, le montant est
la *dépense concernée*, pas un gain acquis — le gain se paierait en qualité, et
rien ici ne permet de mesurer cette perte. Seuls les gains sans contrepartie
affichent un *surcoût évitable*.

**Un surcoût évitable ne compte que la part réellement évitable.** Le levier du
contexte long ne totalise pas le coût des requêtes à gros contexte — l'essentiel
de ce contexte est le travail lui-même. Il ne compte que la fraction relue
*au-delà* du seuil, c'est-à-dire ce qu'aurait évité un compactage systématique.
Les postes retenus portent aussi sur des types de tokens disjoints (écriture de
cache pour les reprises et les invalidations, lecture de cache pour le contexte
long), donc la somme des gains ne peut pas dépasser la facture.

## Les fenêtres de 5 heures

Le quota Claude se recharge par fenêtre glissante ouverte à la première requête
suivant une pause. Tempo rejoue cette règle sur l'historique.

Anthropic ne publie pas de plafond chiffré en tokens pour Pro et Max, et
l'inventer donnerait une jauge fausse. La jauge se lit donc **par rapport à ta
fenêtre la plus chargée** : une comparaison mesurable, plutôt qu'un pourcentage
d'un plafond inconnu.

## Structure

| Chemin | Rôle |
| --- | --- |
| `src/lib/pricing.ts` | Grille tarifaire et calcul de coût |
| `src/lib/scan.ts` | Lecture en flux des transcripts, déduplication, cache mémoire |
| `src/lib/aggregate.ts` | Calibration et agrégations (jour, modèle, projet, fenêtre) |
| `src/lib/insights.ts` | Leviers d'optimisation : attribution des écritures de cache, effort, modèles |
| `src/lib/series.ts` | Attribution stable des couleurs par modèle |
| `src/components/charts/` | Graphiques SVG écrits à la main |
| `scripts/verify-pricing.ts` | Vérification de la tarification contre la vérité terrain |

## Configuration

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `CLAUDE_PROJECTS_PATH` | `~/.claude/projects` | Répertoire des transcripts |
| `CLAUDE_CONFIG_PATH` | `~/.claude.json` | Fichier d'où est lu le compte |

## Notes de conception

La palette catégorielle et la rampe séquentielle ont été validées contre les
surfaces réelles de l'application dans les deux thèmes : bande de clarté, plancher
de chroma, séparation sous simulation du daltonisme et contraste. Deux teintes
passent sous 3:1 en mode clair ; les étiquettes directes au bout des barres et la
vue tableau (bouton « Voir le tableau ») sont la compensation obligatoire, pas un
supplément. Les graphiques sont écrits en SVG à la main pour respecter les
spécifications de marques — extrémités arrondies côté données, vide de 2 px entre
segments jointifs, barres plafonnées à 24 px.

Le niveau d'effort est une échelle *ordonnée*, pas une liste de catégories : il
prend donc une rampe d'une seule teinte, dont les pas montent avec le niveau, et
non des couleurs de série. Les deux pas les plus proches de la surface sont
écartés — ils servent à représenter « presque zéro » dans une échelle continue et
ne tiennent pas le contraste minimal exigé d'une échelle ordonnée.
