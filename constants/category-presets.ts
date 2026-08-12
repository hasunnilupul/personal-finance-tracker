/**
 * Icons offered when creating a category.
 *
 * A fixed grid rather than a full emoji picker: a household needs a couple of
 * dozen recognisable symbols, and a searchable picker would be a dependency
 * and a lot of UI for no real gain. The field still accepts anything, so a
 * pasted emoji works.
 */
// Laid out as the 8-column grid the picker renders, so the set is readable here.
// prettier-ignore
export const CATEGORY_ICONS = [
  "🍔", "🛒", "🚗", "⛽", "🏠", "💡", "📱", "🛍️",
  "🎬", "🎮", "✈️", "🏥", "💊", "🎓", "📚", "🐾",
  "👕", "💇", "🎁", "🍺", "☕", "🏋️", "🔧", "📦",
  "💼", "🧾", "📈", "💰", "🏦", "💳", "🤝", "⭐",
];

/**
 * Colour swatches, chosen to stay distinguishable against both themes.
 */
// prettier-ignore
export const CATEGORY_COLORS = [
  "#FF6B6B", "#F97316", "#FBBF24", "#FFE66D",
  "#4ADE80", "#10B981", "#4ECDC4", "#38BDF8",
  "#6366F1", "#A78BFA", "#C7B3E5", "#FB7185",
  "#94A3B8", "#78716C", "#FF8B94", "#95E1D3",
];

export const DEFAULT_CATEGORY_ICON = CATEGORY_ICONS[0];
export const DEFAULT_CATEGORY_COLOR = CATEGORY_COLORS[0];
