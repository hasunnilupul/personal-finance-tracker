/**
 * Categories every new space starts with, so the pickers are never empty.
 *
 * Members can add their own; these are only a starting point.
 */
export const APP_DEFAULT_CATEGORIES = [
  { name: "Food & Dining", icon: "🍔", color: "#FF6B6B" },
  { name: "Transportation", icon: "🚗", color: "#4ECDC4" },
  { name: "Shopping", icon: "🛍️", color: "#FFE66D" },
  { name: "Entertainment", icon: "🎬", color: "#95E1D3" },
  { name: "Utilities", icon: "💡", color: "#C7B3E5" },
  { name: "Health", icon: "🏥", color: "#FF8B94" },
];

/**
 * Income has its own categories — an expense list is no use for classifying
 * a salary, and the two are filtered separately everywhere.
 */
export const APP_DEFAULT_INCOME_CATEGORIES = [
  { name: "Salary", icon: "💼", color: "#4ADE80" },
  { name: "Freelance", icon: "🧾", color: "#38BDF8" },
  { name: "Investments", icon: "📈", color: "#A78BFA" },
  { name: "Gifts", icon: "🎁", color: "#FB7185" },
  { name: "Other Income", icon: "💰", color: "#FBBF24" },
];
