// The user's recent searches, kept in the browser's local storage. Pure functions with the
// storage passed in, so the page and the tests run the same code.
export const STORAGE_KEY = 'signal10.recent';
export const LIMIT = 5;

const tidy = (topic) => String(topic ?? '').trim().replace(/\s+/g, ' ');

// Newest first. A topic already in the list moves to the front; letter case and spacing
// do not make it a different topic. A blank topic changes nothing.
export function addRecent(list, topic) {
  const added = tidy(topic);
  if (!added) return list;
  return [added, ...list.filter((kept) => kept.toLowerCase() !== added.toLowerCase())].slice(0, LIMIT);
}

// Storage can be blocked, or hold anything; whatever is wrong, the answer is an empty list.
export function loadRecent(storage) {
  try {
    const saved = JSON.parse(storage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved.filter((topic) => typeof topic === 'string' && tidy(topic)).slice(0, LIMIT) : [];
  } catch {
    return [];
  }
}

export function saveRecent(storage, list) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Private windows and full storage refuse writes; the search itself still works.
  }
}
