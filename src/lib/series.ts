/**
 * Attribution des couleurs de série aux modèles.
 *
 * La couleur suit le modèle, jamais son rang : changer de période ne doit pas
 * repeindre les modèles qui restent affichés. L'emplacement est donc dérivé
 * d'un ordre canonique figé, indépendant des données de la période.
 */

/** Ordre canonique des modèles, du plus capable au plus léger. */
const CANONICAL_ORDER = [
  "claude-fable-5-1",
  "claude-mythos-5-1",
  "claude-fable-5",
  "claude-mythos-5",
  "claude-opus-5",
  "claude-opus-4-8",
  "claude-opus-4-7",
  "claude-opus-4-6",
  "claude-opus-4-5",
  "claude-sonnet-5",
  "claude-sonnet-4-6",
  "claude-sonnet-4-5",
  "claude-haiku-4-5",
  "claude-3-5-haiku",
];

/** Nombre d'emplacements catégoriels disponibles avant repli. */
const SLOT_COUNT = 5;
/** Dernier emplacement, réservé au regroupement « Autres ». */
const OVERFLOW_SLOT = SLOT_COUNT - 1;

/**
 * Retourne l'emplacement de palette d'un modèle, entre 0 et 4.
 *
 * Les modèles au-delà des quatre premiers emplacements partagent le dernier,
 * comme le veut la règle : on replie plutôt que de recycler les teintes.
 */
export function modelSlot(model: string, present: string[]): number {
  // On classe les modèles présents selon l'ordre canonique, en plaçant les
  // inconnus à la suite, par ordre alphabétique, pour rester déterministe.
  const ranked = [...present].sort((a, b) => {
    const indexA = CANONICAL_ORDER.indexOf(a);
    const indexB = CANONICAL_ORDER.indexOf(b);
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return a.localeCompare(b);
  });

  const position = ranked.indexOf(model);
  if (position === -1) return OVERFLOW_SLOT;
  return Math.min(position, OVERFLOW_SLOT);
}
