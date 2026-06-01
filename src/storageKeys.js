export const STORAGE_KEYS = {
  darkMode: "adsduck-dark",
  bookmarks: "adsduck-bookmarks",
  scrollY: "adsduck-scroll-y",
  category: "adsduck-category",
  visited: "adsduck-visited",
  sort: "adsduck-sort",
  search: "adsduck-search",
  recentSearches: "adsduck-recent-searches",
  pointWallets: "adsduck-point-wallets",
  boardPosts: "adsduck-board-posts",
  penaltyLedger: "adsduck-penalty-ledger",
  userMessages: "adsduck-user-messages",
};

export const LEGACY_STORAGE_KEYS = {
  darkMode: "ph-dark",
  bookmarks: "ph-bookmarks",
  scrollY: "ph-scroll-y",
  category: "ph-category",
  visited: "ph-visited",
  sort: "ph-sort",
  search: "ph-search",
  recentSearches: "ph-recent-searches",
  pointWallets: "ph-point-wallets",
  boardPosts: "ph-board-posts",
  penaltyLedger: "ph-penalty-ledger",
  userMessages: "ph-user-messages",
};

export function getStoredItem(storage, key, legacyKey = null) {
  try {
    const current = storage.getItem(key);
    if (current !== null) return current;

    const legacy = legacyKey ? storage.getItem(legacyKey) : null;
    if (legacy !== null) {
      storage.setItem(key, legacy);
    }
    return legacy;
  } catch {
    return null;
  }
}

export function setStoredItem(storage, key, value) {
  try {
    storage.setItem(key, value);
  } catch {
    // Storage can be unavailable in private browsing or restricted embeds.
  }
}

export function removeStoredItem(storage, key, legacyKey = null) {
  try {
    storage.removeItem(key);
    if (legacyKey) storage.removeItem(legacyKey);
  } catch {
    // Storage can be unavailable in private browsing or restricted embeds.
  }
}
